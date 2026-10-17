-- LOCAL ONLY. Apply after all earlier repair migrations, following backup/staging review.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
-- The checkout has long written these display fields, but the live table lacks
-- them. Institution fees remain outside the amount charged by Kagie.
alter table public.application_institutions
 add column if not exists application_fee numeric not null default 0,
 add column if not exists application_fee_label text not null default '',
 add column if not exists application_fee_note text not null default '';
create table if not exists public.payment_service_prices(
 code text primary key,name text not null,amount_cents bigint not null check(amount_cents between 0 and 99999999),
 currency text not null default 'ZAR' check(currency='ZAR'),enabled boolean not null default true,
 requires_quote boolean not null default false,updated_at timestamptz not null default now()
);
insert into public.payment_service_prices(code,name,amount_cents,requires_quote) values
 ('funding_assist','Funding Assist',22000,false),('change_email','Change Email',5000,false),
 ('re_apply','Re-Apply Help',5000,false),('forgot_pin','Forgot PIN',1000,false),
 ('forgot_student_number','Forgot Student Number',1000,false),
 ('transport_assist','Transport Assist',0,true),('accommodation_assist','Accommodation Assist',0,true)
on conflict(code) do nothing;
alter table public.payment_service_prices enable row level security;
revoke all on public.payment_service_prices from public,anon,authenticated;
grant select on public.payment_service_prices to authenticated;
grant insert,update,delete on public.payment_service_prices to authenticated;
grant all on public.payment_service_prices to service_role;
drop policy if exists service_price_read on public.payment_service_prices;
create policy service_price_read on public.payment_service_prices for select to authenticated using(kagie_private.account_active());
drop policy if exists service_price_master on public.payment_service_prices;
create policy service_price_master on public.payment_service_prices for all to authenticated
 using(kagie_private.account_active() and public.current_role()='master_admin')
 with check(kagie_private.account_active() and public.current_role()='master_admin');

alter table public.payments add column if not exists expected_amount_cents numeric generated always as (round(amount*100)) stored;
alter table public.payments add column if not exists gateway_mode text not null default '' check(gateway_mode in ('','test','live'));
-- Historical rows are deliberately not assigned a mode from user-authored notes.
create or replace function kagie_private.pin_yoco_mode() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' and new.provider='yoco' and new.checkout_snapshot->>'gatewayMode' in ('test','live') then new.gateway_mode:=new.checkout_snapshot->>'gatewayMode'; end if;
 if tg_op='UPDATE' and old.gateway_mode<>'' and new.gateway_mode is distinct from old.gateway_mode then raise exception 'Payment mode is immutable'; end if;
 return new;
end;$$;
drop trigger if exists yoco_pin_mode on public.payments;
create trigger yoco_pin_mode before insert or update on public.payments for each row execute function kagie_private.pin_yoco_mode();
revoke all on function kagie_private.pin_yoco_mode() from public,anon,authenticated;

alter table public.payment_webhook_events add column if not exists delivery_id text;
alter table public.payment_webhook_events add column if not exists payload_hash text;
alter table public.payment_webhook_events add column if not exists result jsonb;
create unique index if not exists yoco_delivery_unique on public.payment_webhook_events(provider,delivery_id) where delivery_id is not null;

-- A completed service purchase may share an unpaid application with a later,
-- different service order. Keep every payment; rotate only the ephemeral lease.
create or replace function public.reserve_yoco_checkout(p_application_id uuid,p_user_id uuid,p_provider text,p_fingerprint text,p_order_key text,p_payment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.payment_checkout_leases;pay public.payments;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Trusted checkout service required' using errcode='42501'; end if;
 if p_provider is distinct from 'yoco' or coalesce(p_payment#>>'{checkout_snapshot,gatewayMode}','') not in ('test','live') then raise exception 'Invalid Yoco reservation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_order_key,0));
 perform 1 from public.applications where id=p_application_id and user_id=p_user_id for update;
 if not found then raise exception 'Application unavailable'; end if;
 select * into l from public.payment_checkout_leases where application_id=p_application_id for update;
 if found and l.provider='yoco' and l.response is null and l.created_at<now()-interval '15 minutes' then
  raise exception 'This interrupted checkout needs provider reconciliation before retrying. Contact Kagie with your reference.';
 end if;
 if found and l.provider='yoco' and l.order_key<>p_order_key then
  select * into pay from public.payments where id=l.payment_id;
  if pay.status='Verified' and pay.checkout_snapshot->'containsApplicationPack'='false'::jsonb then
   delete from public.payment_checkout_leases where application_id=p_application_id;
   insert into public.payment_reconciliation(payment_id,application_id,provider,event_key,kind,resolved_at,resolution)
    values(pay.id,pay.application_id,'yoco','lease-completed:'||pay.id,'service_checkout_completed',now(),'Verified service order completed; new order may reserve a checkout') on conflict(event_key) do nothing;
  end if;
 end if;
 return public.reserve_payment_checkout(p_application_id,p_user_id,p_provider,p_fingerprint,p_order_key,p_payment);
end;$$;
revoke all on function public.reserve_yoco_checkout(uuid,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_yoco_checkout(uuid,uuid,text,text,text,jsonb) to service_role;

create or replace function public.replace_checkout_institutions(p_application_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.applications;n integer;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Trusted checkout service required' using errcode='42501'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>100 then raise exception 'Invalid institution selection'; end if;
 select * into a from public.applications where id=p_application_id for update;
 if a.id is null or a.payment_status in ('Verified','Paid','Refunded') then raise exception 'Application unavailable or paid'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where length(coalesce(r->>'institution_name','')) not between 1 and 300) then raise exception 'Invalid institution selection'; end if;
 delete from public.application_institutions where application_id=a.id;
 insert into public.application_institutions(application_id,province,institution_type,institution_name,application_fee,application_fee_label,application_fee_note,faculty,choice_1,choice_2,choice_3)
 select a.id,r.province,r.institution_type,r.institution_name,r.application_fee,r.application_fee_label,r.application_fee_note,r.faculty,r.choice_1,r.choice_2,r.choice_3
 from jsonb_to_recordset(p_rows) as r(province text,institution_type text,institution_name text,application_fee numeric,application_fee_label text,application_fee_note text,faculty text,choice_1 text,choice_2 text,choice_3 text);
 get diagnostics n=row_count;return n;
end;$$;
revoke all on function public.replace_checkout_institutions(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replace_checkout_institutions(uuid,jsonb) to service_role;

-- Event deduplication and financial settlement commit or roll back together.
-- Raw card/customer payloads are not retained in the event ledger.
create or replace function public.process_yoco_payment_event(
 p_event_id text,p_delivery_id text,p_payload_hash text,p_payment_id uuid,p_checkout_id text,
 p_gateway_payment_id text,p_gateway_status text,p_success boolean,p_amount_cents bigint,
 p_currency text,p_mode text,p_note text,p_failure_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.payment_webhook_events;pay public.payments;app public.applications;r jsonb;
 service_only boolean; paid_services jsonb; merged_services jsonb;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Trusted Yoco service required' using errcode='42501'; end if;
 if length(coalesce(p_event_id,'')) not between 1 and 200 or length(coalesce(p_delivery_id,'')) not between 1 and 200 or
   p_payload_hash !~ '^[a-f0-9]{64}$' or p_mode not in ('test','live') or p_currency<>'ZAR' or
   p_amount_cents is null or p_amount_cents<=0 or nullif(p_gateway_payment_id,'') is null or
   p_success is null or p_gateway_status is distinct from (case when p_success then 'succeeded' else 'failed' end) then
   raise exception 'Invalid Yoco event' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('yoco-event:'||p_event_id,0));
 select * into previous from public.payment_webhook_events where event_id=p_event_id;
 if found then
  if previous.provider<>'yoco' or previous.payload_hash is distinct from p_payload_hash or previous.payment_id is distinct from p_payment_id then
   raise exception 'Conflicting event identity' using errcode='22023';
  end if;
  return previous.result||jsonb_build_object('applied',false,'duplicate',true);
 end if;
 select * into pay from public.payments where id=p_payment_id for update;
 if pay.id is null or pay.provider<>'yoco' or pay.gateway_checkout_id is distinct from p_checkout_id or
    pay.gateway_mode is distinct from p_mode or pay.expected_amount_cents is distinct from p_amount_cents::numeric or pay.currency<>p_currency then
   raise exception 'Yoco event does not match pinned attempt' using errcode='22023';
 end if;
 select * into app from public.applications where id=pay.application_id for update;
 if app.id is null or pay.user_id is distinct from app.user_id then raise exception 'Yoco owner mismatch'; end if;
 service_only:=pay.checkout_snapshot->'containsApplicationPack'='false'::jsonb;
 if service_only then
  if pay.status in ('Verified','Refunded') then
   if p_success and pay.gateway_payment_id is not null and pay.gateway_payment_id<>p_gateway_payment_id then raise exception 'Payment identity mismatch' using errcode='22023'; end if;
   r:=jsonb_build_object('applied',false,'duplicate',true,'application_already_paid',false);
  elsif not p_success and pay.status='Failed' and pay.gateway_payment_id=p_gateway_payment_id then
   r:=jsonb_build_object('applied',false,'duplicate',true,'application_already_paid',false);
  else
   update public.payments set status=case when p_success then 'Verified' else 'Failed' end,
    gateway_payment_id=p_gateway_payment_id,gateway_status=p_gateway_status,
    paid_at=case when p_success then coalesce(paid_at,now()) else paid_at end,
    failure_reason=case when p_success then '' else coalesce(p_failure_reason,'') end,
    note=coalesce(p_note,note),updated_at=now() where id=pay.id;
   r:=jsonb_build_object('applied',true,'duplicate',false,'application_already_paid',false);
   if p_success then
    select coalesce(jsonb_agg(value||jsonb_build_object('paymentStatus','Verified','paymentId',pay.id)),'[]') into paid_services
     from jsonb_array_elements(coalesce(pay.checkout_snapshot->'services','[]'));
    select coalesce(jsonb_agg(value),'[]') into merged_services from (
     select value from jsonb_array_elements(coalesce(app.application_payload->'services','[]')) old
      where not exists(select 1 from jsonb_array_elements(paid_services) purchased where purchased->>'id'=old.value->>'id')
     union all select value from jsonb_array_elements(paid_services)
    ) services;
    -- Only paid service lines change; package choices, financial fields and status history remain intact.
    update public.applications set application_payload=jsonb_set(coalesce(app.application_payload,'{}'),'{services}',merged_services,true),updated_at=now() where id=app.id;
   end if;
  end if;
 else
  r:=public.settle_gateway_payment(pay.id,'yoco',p_checkout_id,p_gateway_payment_id,p_gateway_status,p_success,
    p_amount_cents::numeric/100,p_currency,p_note,p_failure_reason);
 end if;
 insert into public.payment_webhook_events(event_id,delivery_id,provider,event_type,payment_id,application_id,gateway_checkout_id,
   gateway_payment_id,payload_hash,result,processing_status,payload)
 values(p_event_id,p_delivery_id,'yoco',case when p_success then 'payment.succeeded' else 'payment.failed' end,pay.id,app.id,
   p_checkout_id,p_gateway_payment_id,p_payload_hash,r,'processed',jsonb_build_object('amount',p_amount_cents,'currency',p_currency,'mode',p_mode));
 return r;
end;$$;
revoke all on function public.process_yoco_payment_event(text,text,text,uuid,text,text,text,boolean,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.process_yoco_payment_event(text,text,text,uuid,text,text,text,boolean,bigint,text,text,text,text) to service_role;
create or replace function public.process_yoco_refund_event(
 p_event_id text,p_delivery_id text,p_payload_hash text,p_checkout_id text,p_event_type text,p_mode text,p_details jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare pay public.payments;previous public.payment_webhook_events;r jsonb:=jsonb_build_object('ok',true,'needsReview',true);
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Trusted Yoco service required' using errcode='42501'; end if;
 if length(coalesce(p_event_id,'')) not between 1 and 200 or length(coalesce(p_delivery_id,'')) not between 1 and 200 or
   coalesce(p_payload_hash,'') !~ '^[a-f0-9]{64}$' or coalesce(p_mode,'') not in ('test','live') then raise exception 'Invalid refund event' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('yoco-event:'||p_event_id,0));
 select * into previous from public.payment_webhook_events where event_id=p_event_id;
 if found then
  if previous.provider<>'yoco' or previous.payload_hash is distinct from p_payload_hash then raise exception 'Conflicting refund identity' using errcode='22023'; end if;
  return previous.result||jsonb_build_object('duplicate',true);
 end if;
 select * into pay from public.payments where provider='yoco' and gateway_checkout_id=p_checkout_id for update;
 if pay.id is null or pay.gateway_mode is distinct from p_mode then raise exception 'Refund checkout or mode mismatch' using errcode='22023'; end if;
 perform public.record_gateway_refund(p_checkout_id,p_event_id,p_event_type,p_details);
 insert into public.payment_webhook_events(event_id,delivery_id,provider,event_type,payment_id,application_id,gateway_checkout_id,
   payload_hash,result,payload) values(p_event_id,p_delivery_id,'yoco',p_event_type,pay.id,pay.application_id,p_checkout_id,p_payload_hash,r,p_details);
 return r;
end;$$;
revoke all on function public.process_yoco_refund_event(text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.process_yoco_refund_event(text,text,text,text,text,text,jsonb) to service_role;
commit;
