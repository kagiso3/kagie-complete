-- Durable checkout reservation: never expire an ambiguous provider charge locally.
-- Operator/provider reconciliation is required before replacing an active link.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
create table if not exists public.payment_checkout_leases(
 application_id uuid primary key references public.applications(id),
 user_id uuid not null references public.profiles(id),
 payment_id uuid unique not null references public.payments(id),
 order_key text not null, fingerprint text not null,provider text not null check(provider in ('yoco','payfast')),
 response jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,order_key)
);
create table if not exists public.payment_reconciliation(
 id uuid primary key default gen_random_uuid(),payment_id uuid references public.payments(id),
 application_id uuid references public.applications(id),provider text not null,
 event_key text not null unique,kind text not null,details jsonb not null default '{}',
 resolved_at timestamptz,resolved_by uuid references public.profiles(id),resolution text not null default '',created_at timestamptz not null default now()
);
alter table public.payment_checkout_leases enable row level security;
alter table public.payment_reconciliation enable row level security;
revoke all on public.payment_checkout_leases,public.payment_reconciliation from public,anon,authenticated;
grant all on public.payment_checkout_leases,public.payment_reconciliation to service_role;
grant select on public.payment_checkout_leases,public.payment_reconciliation to authenticated;
drop policy if exists checkout_master_read on public.payment_checkout_leases;
create policy checkout_master_read on public.payment_checkout_leases for select to authenticated using(public.current_role()='master_admin');
drop policy if exists reconciliation_master_read on public.payment_reconciliation;
create policy reconciliation_master_read on public.payment_reconciliation for select to authenticated using(public.current_role()='master_admin');
create unique index if not exists repair_gateway_payment_unique on public.payments(provider,gateway_payment_id) where nullif(gateway_payment_id,'') is not null;

create or replace function public.reserve_payment_checkout(p_application_id uuid,p_user_id uuid,p_provider text,p_fingerprint text,p_order_key text,p_payment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications;l public.payment_checkout_leases;attempt_id uuid;promo public.promo_campaigns;code_arg text;reserved integer;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Trusted checkout service required' using errcode='42501'; end if;
 if p_provider not in ('yoco','payfast') or length(p_fingerprint) not between 10 and 200 or length(p_order_key) not between 10 and 200 or
 jsonb_typeof(p_payment)<>'object' or coalesce((p_payment->>'amount')::numeric,0)<=0 or p_payment->>'currency'<>'ZAR' then raise exception 'Invalid payment reservation' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_order_key,0));
 select * into a from public.applications where id=p_application_id for update;
 if a.id is null or a.user_id is distinct from p_user_id or a.payment_status in ('Verified','Paid','Refunded') then raise exception 'Application is unavailable or paid' using errcode='P0001'; end if;
 select * into l from public.payment_checkout_leases where application_id=a.id;
 if found then
  if l.provider<>p_provider or l.fingerprint<>p_fingerprint then raise exception 'An active checkout already exists. Resume it or contact support for provider reconciliation.' using errcode='P0001'; end if;
  return jsonb_build_object('payment_id',l.payment_id,'response',l.response,'reused',true);
 end if;
 if exists(select 1 from public.payment_checkout_leases where user_id=p_user_id and order_key=p_order_key) then raise exception 'This order already has a checkout' using errcode='P0001'; end if;
 -- Reserve limited promotions under a row lock; failed/ambiguous checkouts do not
 -- release a discount while their provider link may still be payable.
 code_arg:=nullif(p_payment#>>'{checkout_snapshot,promoCode}','');
 if code_arg is not null then
  select * into promo from public.promo_campaigns where code=code_arg for update;
  select count(*) into reserved from public.payments where checkout_snapshot->>'promoCode'=code_arg and status not in ('Verified','Refunded','Rejected','Cancelled');
  if promo.id is null or not promo.is_active or promo.redeemed_user_ids ? p_user_id::text or
    promo.max_uses>0 and promo.used_count+reserved>=promo.max_uses or exists(select 1 from public.payments where user_id=p_user_id and checkout_snapshot->>'promoCode'=code_arg and status not in ('Rejected','Cancelled')) then raise exception 'Promotion is unavailable or reserved' using errcode='P0001'; end if;
 end if;
 attempt_id:=gen_random_uuid();
 insert into public.payments(id,application_id,user_id,payer_name,phone,reference,method,note,amount,status,provider,currency,checkout_snapshot,gateway_status,gateway_checkout_id)
 values(attempt_id,a.id,p_user_id,coalesce(p_payment->>'payer_name',''),coalesce(p_payment->>'phone',''),coalesce(p_payment->>'reference',''),
 case p_provider when 'yoco' then 'Yoco Checkout' else 'PayFast Checkout' end,'',round((p_payment->>'amount')::numeric,2),'Payment Pending',p_provider,'ZAR',coalesce(p_payment->'checkout_snapshot','{}'),'creating',case when p_provider='payfast' then attempt_id::text else null end);
 insert into public.payment_checkout_leases(application_id,user_id,payment_id,order_key,fingerprint,provider) values(a.id,p_user_id,attempt_id,p_order_key,p_fingerprint,p_provider);
 insert into public.payment_reconciliation(payment_id,application_id,provider,event_key,kind) values(attempt_id,a.id,p_provider,'checkout:'||attempt_id,'checkout_started');
 return jsonb_build_object('payment_id',attempt_id,'response',null,'reused',false);
end; $$;
create or replace function public.complete_payment_checkout(p_payment_id uuid,p_checkout_id text,p_note text,p_response jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.payments;l public.payment_checkout_leases;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Trusted checkout service required' using errcode='42501'; end if;
 select * into p from public.payments where id=p_payment_id for update;
 if p.id is null or nullif(p_checkout_id,'') is null or jsonb_typeof(p_response)<>'object' then raise exception 'Invalid checkout completion'; end if;
 select * into l from public.payment_checkout_leases where payment_id=p.id for update;
 if l.payment_id is null then raise exception 'Checkout reservation unavailable'; end if;
 if p.gateway_checkout_id is not null and p.gateway_checkout_id<>p_checkout_id then raise exception 'Checkout identifier mismatch'; end if;
 if l.response is not null then return l.response; end if;
 update public.payments set gateway_checkout_id=p_checkout_id,gateway_status=case when status in ('Verified','Refunded','Failed') then gateway_status else 'created' end,note=case when status in ('Verified','Refunded','Failed') then note else coalesce(p_note,'') end,updated_at=now() where id=p.id;
 update public.payment_checkout_leases set response=p_response,updated_at=now() where payment_id=p.id;
 update public.payment_reconciliation set resolved_at=now(),resolution='Provider checkout attached' where event_key='checkout:'||p.id;
 return p_response;
end; $$;
create or replace function kagie_private.record_settlement_reconciliation() returns trigger language plpgsql security definer set search_path='' as $$
declare code_arg text:=nullif(new.checkout_snapshot->>'promoCode','');
begin
 if new.status='Verified' and old.status is distinct from 'Verified' then
  if code_arg is not null then update public.promo_campaigns set used_count=used_count+1,redeemed_user_ids=redeemed_user_ids||to_jsonb(new.user_id::text),updated_at=now() where code=code_arg and not redeemed_user_ids ? new.user_id::text; end if;
  if new.checkout_snapshot->'applicationAlreadyPaid'='true'::jsonb then insert into public.payment_reconciliation(payment_id,application_id,provider,event_key,kind) values(new.id,new.application_id,new.provider,'extra-paid:'||new.id,'additional_payment') on conflict(event_key) do nothing; end if;
 end if;
 if new.status='Refunded' and old.status is distinct from 'Refunded' then insert into public.payment_reconciliation(payment_id,application_id,provider,event_key,kind) values(new.id,new.application_id,new.provider,'refund:'||new.id,'refund_recorded') on conflict(event_key) do nothing; end if;
 return new;
end; $$;
drop trigger if exists repair_settlement_reconciliation on public.payments;
create trigger repair_settlement_reconciliation after update on public.payments for each row execute function kagie_private.record_settlement_reconciliation();
revoke all on function public.reserve_payment_checkout(uuid,uuid,text,text,text,jsonb),public.complete_payment_checkout(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_payment_checkout(uuid,uuid,text,text,text,jsonb),public.complete_payment_checkout(uuid,text,text,jsonb) to service_role;
revoke all on function kagie_private.record_settlement_reconciliation() from public,anon,authenticated;
create or replace function public.record_gateway_refund(p_checkout_id text,p_event_id text,p_event_type text,p_details jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.payments;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Trusted payment service required' using errcode='42501'; end if;
 select * into p from public.payments where provider='yoco' and gateway_checkout_id=p_checkout_id for update;
 if p.id is null or nullif(p_event_id,'') is null or p_event_type not in ('refund.succeeded','refund.failed') or
   p_details->>'currency'<>'ZAR' or coalesce((p_details->>'amount')::numeric,0)<=0 or (p_details->>'amount')::numeric>p.amount*100 then raise exception 'Refund cannot be reconciled'; end if;
 insert into public.payment_reconciliation(payment_id,application_id,provider,event_key,kind,details)
 values(p.id,p.application_id,'yoco','yoco-refund:'||p_event_id,p_event_type,p_details) on conflict(event_key) do nothing;
 -- Preserve the original settlement, including partial refunds. A master reviews
 -- entitlement changes separately; receiving a notification never sends money.
 return true;
end; $$;
revoke all on function public.record_gateway_refund(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_gateway_refund(text,text,text,jsonb) to service_role;
commit;
