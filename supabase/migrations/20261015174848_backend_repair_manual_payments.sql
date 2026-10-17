-- Local, additive manual-payment repair. Apply only through the approved release procedure.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
alter table public.application_packs add column if not exists is_active boolean not null default true;

-- Invoker guards distinguish vetted SECURITY DEFINER RPCs from direct REST writes.
-- There is no client-settable bypass flag. Only migration-owned functions inherit postgres.
create or replace function kagie_private.guard_application_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') then return new; end if;
  if jsonb_typeof(new.application_payload)<>'object' then raise exception 'Application data must be an object'; end if;
  if auth.uid() is not null and public.current_role()<>'master_admin' then
    if TG_OP='INSERT' then
      if new.assistant_id is not null then raise exception 'Only Master Admin assigns applications' using errcode='42501'; end if;
      if public.current_role()='user' and (new.payment_status<>'Payment Pending' or new.status not in ('Draft','Package Selected','Awaiting Payment')) then
        raise exception 'Payment verification and staff progress require trusted review' using errcode='42501';
      end if;
      if public.current_role()='user' and coalesce(new.application_payload->'services','[]'::jsonb)<>'[]'::jsonb then
        raise exception 'Paid service fulfillment is managed by the server' using errcode='42501';
      end if;
    else
      if new.user_id is distinct from old.user_id or new.assistant_id is distinct from old.assistant_id then
        raise exception 'Only Master Admin changes application ownership or assignments' using errcode='42501';
      end if;
      if public.current_role()='assistant_admin' and new.payment_status is distinct from old.payment_status then
        raise exception 'Only Master Admin reviews payments' using errcode='42501';
      end if;
      if public.current_role()='user' then
        if coalesce(new.application_payload->'services','[]'::jsonb) is distinct from coalesce(old.application_payload->'services','[]'::jsonb) then
          raise exception 'Paid service fulfillment is managed by the server' using errcode='42501';
        end if;
        if new.payment_status is distinct from old.payment_status and not
          (old.payment_status='Payment Pending' and new.payment_status='Pending Verification') then
          raise exception 'Payment verification requires trusted review' using errcode='42501';
        end if;
        if old.payment_status='Verified' and
          (new.payment_amount is distinct from old.payment_amount or new.payment_method is distinct from old.payment_method or
           new.payment_reference is distinct from old.payment_reference or new.payment_note is distinct from old.payment_note or
           new.package_id is distinct from old.package_id) then
          raise exception 'A settled payment cannot be edited by a learner' using errcode='42501';
        end if;
        if (new.payment_method is distinct from old.payment_method or new.payment_note is distinct from old.payment_note) and
          (lower(coalesce(new.payment_method,'')) in ('payfast','yoco','card') or
           coalesce(new.payment_note,'') ~* '"(gateway|provider|paidAt|gatewayStatus|gatewayCheckoutId|gatewayPaymentId)"') then
          raise exception 'Gateway payment metadata is managed by the server' using errcode='42501';
        end if;
        if new.status is distinct from old.status and new.status not in
          ('Draft','Package Selected','Awaiting Payment','Pending Details','Incomplete','Submitted','Cancelled') then
          raise exception 'Staff application progress cannot be set by a learner' using errcode='42501';
        end if;
        if new.status in ('Pending Details','Submitted') and new.status is distinct from old.status and old.payment_status<>'Verified' then
          raise exception 'Verified payment is required before submitting details' using errcode='42501';
        end if;
      end if;
    end if;
  end if;
  return new;
end; $$;
create or replace function kagie_private.guard_payment_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare payload jsonb:=to_jsonb(new);
begin
  if current_user in ('postgres','service_role','supabase_admin') then return new; end if;
  if coalesce(payload->>'user_id','')<>'' and not exists(select 1 from public.applications a
    where a.id=new.application_id and a.user_id::text=payload->>'user_id') then
    raise exception 'Payment owner must match its application learner' using errcode='42501';
  end if;
  if auth.uid() is not null and public.current_role()<>'master_admin' then
    if TG_OP='UPDATE' and new.application_id is distinct from old.application_id then
      raise exception 'Payment application ownership cannot be reassigned' using errcode='42501';
    end if;
    if new.status not in ('Payment Pending','Pending Verification') or
      lower(coalesce(new.method,'')) in ('payfast','yoco','card','online','gateway') or
      coalesce(payload->>'provider','')<>'' or coalesce(payload->>'gateway_checkout_id','')<>'' or
      coalesce(payload->>'gateway_payment_id','')<>'' or coalesce(payload->>'gateway_status','')<>'' or
      coalesce(payload->>'paid_at','')<>'' then
      raise exception 'Gateway and verified payments are managed by trusted server review' using errcode='42501';
    end if;
  end if;
  if new.amount<0 then raise exception 'Payment amount cannot be negative'; end if;
  return new;
end; $$;
create or replace function public.record_manual_payment(p_application_id uuid,p_owner_id uuid,p_pack_id uuid,p_payer_name text,p_phone text,p_reference text,p_method text,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications;p public.payments;pack public.application_packs;
begin
 if current_setting('role',true)<>'service_role' and (not kagie_private.account_active() or auth.uid() is distinct from p_owner_id) then raise exception 'Application unavailable' using errcode='42501'; end if;
 if p_method not in ('EFT','Cash Deposit','Card Transfer','Mobile Payment') or length(trim(p_reference)) not between 2 and 200 or length(trim(p_payer_name)) not between 2 and 200 or length(p_phone) not between 6 and 80 or (length(coalesce(p_note,''))>2000 or coalesce(p_note,'') like '__KAGIE_PAYMENT_META__%') then raise exception 'Invalid manual payment details' using errcode='22023'; end if;
 select * into a from public.applications where id=p_application_id for update;
 if a.id is null or a.user_id is distinct from p_owner_id then raise exception 'Application unavailable' using errcode='42501'; end if;
 select * into p from public.payments where application_id=a.id and provider='manual' and reference=trim(p_reference) and method=p_method order by created_at desc limit 1;
 if found then return jsonb_build_object('payment',to_jsonb(p),'duplicate',true); end if;
 if a.payment_status in ('Verified','Paid','Refunded') or exists(select 1 from public.payment_checkout_leases where application_id=a.id) or exists(select 1 from public.payments where application_id=a.id and status in ('Payment Pending','Pending Verification','Pending','Paid','Verified')) then raise exception 'A payment is already active or confirmed. Resume it or request reconciliation.' using errcode='P0001'; end if;
 select * into pack from public.application_packs where id=p_pack_id and is_active;
 if pack.id is null or pack.price<=0 then raise exception 'Package price is unavailable' using errcode='22023'; end if;
 insert into public.payments(application_id,user_id,payer_name,phone,reference,method,note,amount,status,provider,currency,checkout_snapshot)
 values(a.id,p_owner_id,trim(p_payer_name),p_phone,trim(p_reference),p_method,coalesce(p_note,''),pack.price,'Pending Verification','manual','ZAR',jsonb_build_object('packId',pack.id,'services','[]'::jsonb)) returning * into p;
 update public.applications set package_id=pack.id,application_type=pack.application_type,payer_name=p.payer_name,payer_phone=p.phone,payment_reference=p.reference,payment_method=p.method,payment_note=p.note,payment_amount=pack.price,payment_status='Pending Verification',status='Awaiting Payment',updated_at=now() where id=a.id;
 insert into public.notifications(user_id,title,message,notification_type) values(p_owner_id,'Payment submitted','Your manual payment is awaiting staff verification.','info');
 return jsonb_build_object('payment',to_jsonb(p),'duplicate',false);
end; $$;
revoke all on function public.record_manual_payment(uuid,uuid,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.record_manual_payment(uuid,uuid,uuid,text,text,text,text,text) to authenticated,service_role;

create or replace function public.staff_review_payment(application_id_arg uuid,status_arg text,reason_arg text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications;p public.payments;
begin
 if public.current_role()<>'master_admin' then raise exception 'Only Master Admin reviews payments' using errcode='42501'; end if;
 if status_arg not in ('Pending Verification','Verified','Rejected') or status_arg='Rejected' and trim(coalesce(reason_arg,''))='' or length(coalesce(reason_arg,''))>2000 then raise exception 'Choose a decision and provide a rejection reason'; end if;
 select * into a from public.applications where id=application_id_arg for update;
 if a.id is null then raise exception 'Application unavailable'; end if;
 select * into p from public.payments where application_id=a.id and provider='manual' order by created_at desc limit 1 for update;
 if p.id is null then raise exception 'No manual payment submission is available. Gateway payments require verified provider callbacks.'; end if;
 if p.status=status_arg then return jsonb_build_object('id',a.id,'payment_status',a.payment_status,'duplicate',true); end if;
 if p.status in ('Verified','Paid','Refunded') or a.payment_status in ('Verified','Paid','Refunded') then raise exception 'Settled payments require reconciliation, not a review downgrade'; end if;
 update public.payments set status=status_arg,paid_at=case when status_arg='Verified' then now() else paid_at end,updated_at=now() where id=p.id;
 update public.applications set payment_status=status_arg,payment_amount=p.amount,payment_reference=p.reference,payment_method=p.method,status=case when status_arg='Verified' and status in ('Draft','Awaiting Payment','Package Selected') then 'Pending Details' else status end,updated_at=now() where id=a.id;
 insert into public.payment_reviews(application_id,reviewer_id,status,reason) values(a.id,auth.uid(),status_arg,coalesce(reason_arg,''));
 return jsonb_build_object('id',a.id,'payment_status',status_arg);
end; $$;
revoke all on function public.staff_review_payment(uuid,text,text) from public,anon;
grant execute on function public.staff_review_payment(uuid,text,text) to authenticated;
revoke truncate,references,trigger on all tables in schema public from anon,authenticated;

create or replace function public.staff_capabilities() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 return jsonb_build_object('migration','20261015-repair-1','role',public.current_role(),'document_bucket',exists(select 1 from storage.buckets where id='kagie-documents' and not public),'cv_requests',to_regclass('public.cv_requests') is not null,'private_file_policies',(select count(*)=3 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname in ('kagie_file_read_boundary','kagie_file_insert_boundary','kagie_file_update_boundary')),'checkout_reservations',to_regclass('public.payment_checkout_leases') is not null,'manual_payment_rpc',to_regprocedure('public.record_manual_payment(uuid,uuid,uuid,text,text,text,text,text)') is not null,'refund_reconciliation',to_regclass('public.payment_reconciliation') is not null);
end; $$;
revoke all on function public.staff_capabilities() from public,anon;
grant execute on function public.staff_capabilities() to authenticated;

-- Even a browser master must use the audited manual-review RPC. Gateway facts
-- can only be settled by a signature-verified server callback.
create or replace function kagie_private.guard_browser_payment_confirmation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('postgres','service_role','supabase_admin') then return new; end if;
 if TG_TABLE_NAME='payments' then
  if coalesce(new.provider,'') in ('yoco','payfast') or coalesce(new.gateway_checkout_id,'')<>'' or coalesce(new.gateway_payment_id,'')<>'' or lower(new.method) ~ '(yoco|payfast)' or
    TG_OP='INSERT' and new.status in ('Verified','Paid','Refunded') or TG_OP='UPDATE' and new.status is distinct from old.status and (new.status in ('Verified','Paid','Refunded') or old.status in ('Verified','Paid','Refunded')) then raise exception 'Use verified provider callbacks or audited manual review' using errcode='42501'; end if;
 else
  if TG_OP='INSERT' and new.payment_status in ('Verified','Paid','Refunded') or TG_OP='UPDATE' and new.payment_status is distinct from old.payment_status and (new.payment_status in ('Verified','Paid','Refunded') or old.payment_status in ('Verified','Paid','Refunded')) then raise exception 'Use verified provider callbacks or audited manual review' using errcode='42501'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists repair_browser_confirmation on public.applications;
create trigger repair_browser_confirmation before insert or update on public.applications for each row execute function kagie_private.guard_browser_payment_confirmation();
drop trigger if exists repair_browser_confirmation on public.payments;
create trigger repair_browser_confirmation before insert or update on public.payments for each row execute function kagie_private.guard_browser_payment_confirmation();
revoke all on function kagie_private.guard_browser_payment_confirmation() from public,anon,authenticated;
commit;
