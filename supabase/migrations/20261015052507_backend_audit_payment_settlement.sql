-- LOCAL REVIEW MIGRATION: never run automatically against the live project.
-- Apply after backend_audit_hardening.sql and before deploying the gateway handlers.
begin;
alter table public.payments
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists provider text not null default '',
  add column if not exists gateway_checkout_id text,
  add column if not exists gateway_payment_id text,
  add column if not exists gateway_status text not null default '',
  add column if not exists currency text not null default 'ZAR',
  add column if not exists paid_at timestamptz,
  add column if not exists failure_reason text not null default '',
  add column if not exists checkout_snapshot jsonb not null default '{}';
alter table public.applications add column if not exists application_payload jsonb not null default '{}';
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check
  (status in ('Unpaid','Pending','Paid','Payment Pending','Pending Verification','Verified','Rejected','Failed','Cancelled','Refunded'));
alter table public.applications drop constraint if exists applications_payment_status_check;
alter table public.applications add constraint applications_payment_status_check check
  (payment_status in ('Unpaid','Pending','Paid','Payment Pending','Pending Verification','Verified','Rejected','Failed','Cancelled','Refunded'));
create unique index if not exists idx_payments_gateway_checkout_unique
  on public.payments(gateway_checkout_id) where gateway_checkout_id is not null and gateway_checkout_id<>'';
create index if not exists idx_payments_application_created on public.payments(application_id,created_at desc);
create index if not exists idx_payments_user_created on public.payments(user_id,created_at desc);
create table if not exists public.payment_webhook_events(
  id uuid primary key default gen_random_uuid(), event_id text not null unique,
  provider text not null default 'yoco',event_type text not null default '',
  payment_id uuid references public.payments(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  gateway_checkout_id text,gateway_payment_id text,
  processing_status text not null default 'processed' check(processing_status in ('processed','duplicate','ignored','error')),
  processing_error text not null default '',payload jsonb not null default '{}',
  processed_at timestamptz not null default now(),created_at timestamptz not null default now()
);
alter table public.payment_webhook_events enable row level security;
revoke all on public.payment_webhook_events from anon,authenticated;
grant select on public.payment_webhook_events to authenticated;
grant all on public.payment_webhook_events to service_role;
drop policy if exists kagie_audit_webhook_event_read on public.payment_webhook_events;
create policy kagie_audit_webhook_event_read on public.payment_webhook_events for select to authenticated
using(kagie_private.account_active() and public.current_role()='master_admin');

-- One transaction settles payment and application. A caller supplies only values
-- verified against its provider signature/API; the database checks the pinned attempt.
create or replace function public.settle_gateway_payment(
  p_payment_id uuid,p_provider text,p_checkout_id text,p_gateway_payment_id text,
  p_gateway_status text,p_success boolean,p_amount numeric,p_currency text,
  p_note text,p_failure_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare payment public.payments; application public.applications;
  provider_arg text:=lower(trim(coalesce(p_provider,'')));
  currency_arg text:=upper(trim(coalesce(p_currency,'')));
  already_settled boolean; advanced_status boolean; service_rows jsonb; trusted_services jsonb;
  application_already_paid boolean;
begin
  if coalesce(current_setting('role',true),'')<>'service_role' then
    raise exception 'Trusted payment service required' using errcode='42501';
  end if;
  if provider_arg not in ('yoco','payfast') or nullif(trim(p_checkout_id),'') is null or
    p_success is null or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or currency_arg='' then
    raise exception 'Invalid gateway settlement input' using errcode='22023';
  end if;
  select * into payment from public.payments where id=p_payment_id for update;
  if not found then raise exception 'Payment unavailable' using errcode='22023'; end if;
  if lower(coalesce(nullif(payment.provider,''),payment.method,''))<>provider_arg or
    payment.gateway_checkout_id is distinct from p_checkout_id or
    round(payment.amount,2)<>p_amount or upper(payment.currency)<>currency_arg then
    raise exception 'Gateway settlement does not match the pinned payment attempt' using errcode='22023';
  end if;
  if p_success and payment.status in ('Verified','Refunded') and
    nullif(payment.gateway_payment_id,'') is not null and nullif(p_gateway_payment_id,'') is not null and
    payment.gateway_payment_id<>p_gateway_payment_id then
    raise exception 'Gateway payment identifier mismatch' using errcode='22023';
  end if;
  select * into application from public.applications where id=payment.application_id for update;
  if not found then raise exception 'Application unavailable' using errcode='22023'; end if;
  if payment.user_id is not null and payment.user_id<>application.user_id then
    raise exception 'Payment and application owner mismatch' using errcode='22023';
  end if;
  already_settled:=payment.status in ('Verified','Refunded');
  application_already_paid:=application.payment_status='Verified';
  if payment.status='Refunded' or not p_success and (already_settled or application.payment_status in ('Verified','Refunded')) or
    p_success and payment.status='Verified' and application.payment_status='Verified' then
    return jsonb_build_object('applied',false,'duplicate',true,'application_id',application.id,
      'user_id',application.user_id,'status',payment.status,
      'application_already_paid',coalesce(payment.checkout_snapshot->'applicationAlreadyPaid'='true'::jsonb,false));
  end if;
  if p_success then
    service_rows:=coalesce(payment.checkout_snapshot->'services','[]'::jsonb);
    if jsonb_typeof(service_rows)<>'array' then raise exception 'Invalid trusted checkout services'; end if;
    -- An unpaid historical draft can contain client-authored services. Replace them
    -- with the pinned server snapshot instead of promoting them to paid work.
    -- A second payment for an already-paid application is recorded, while its
    -- existing fulfillment remains intact for manual duplicate-charge reconciliation.
    select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) into trusted_services from
      (select distinct on(value->>'id') value,ordinal from
        jsonb_array_elements(service_rows)
        with ordinality as entries(value,ordinal)
        where value->>'id' is not null order by value->>'id',ordinal) canonical;
    update public.payments set status='Verified',provider=provider_arg,
      user_id=application.user_id,gateway_payment_id=coalesce(nullif(p_gateway_payment_id,''),gateway_payment_id),
      gateway_status=coalesce(p_gateway_status,''),paid_at=coalesce(paid_at,now()),failure_reason='',
      checkout_snapshot=jsonb_set(checkout_snapshot,'{applicationAlreadyPaid}',to_jsonb(application_already_paid),true),
      note=coalesce(p_note,note),updated_at=now() where id=payment.id;
    advanced_status:=application.status in ('Application being processed','Submitted','Under Review','Documents Required',
      'Awaiting Institution Fee','Submitted to Institution','Ready to Apply','Applied','Pending Feedback','Accepted','Rejected','Cancelled');
    if not application_already_paid then
      update public.applications set payment_status='Verified',payment_amount=payment.amount,
      payment_method=provider_arg,payment_reference=coalesce(nullif(p_gateway_payment_id,''),p_checkout_id),
      payment_note=coalesce(p_note,payment_note),payer_name=payment.payer_name,payer_phone=payment.phone,
      application_payload=jsonb_set(coalesce(application_payload,'{}'::jsonb),'{services}',trusted_services,true),
      status=case when advanced_status then status else 'Pending Details' end,
        submitted_at=coalesce(submitted_at,now()),updated_at=now() where id=application.id;
    end if;
  else
    if payment.status='Failed' and payment.gateway_status=coalesce(p_gateway_status,'') then
      return jsonb_build_object('applied',false,'duplicate',true,'application_id',application.id,
        'user_id',application.user_id,'status','Failed',
        'application_already_paid',coalesce(payment.checkout_snapshot->'applicationAlreadyPaid'='true'::jsonb,false));
    end if;
    update public.payments set status='Failed',provider=provider_arg,user_id=application.user_id,
      gateway_payment_id=coalesce(nullif(p_gateway_payment_id,''),gateway_payment_id),
      gateway_status=coalesce(p_gateway_status,''),failure_reason=coalesce(p_failure_reason,''),
      note=coalesce(p_note,note),updated_at=now() where id=payment.id;
    update public.applications set payment_status='Failed',payment_note=coalesce(p_note,payment_note),updated_at=now()
      where id=application.id;
  end if;
  return jsonb_build_object('applied',true,'duplicate',false,'application_id',application.id,
    'user_id',application.user_id,'status',case when p_success then 'Verified' else 'Failed' end,
    'application_already_paid',application_already_paid);
end; $$;
revoke all on function public.settle_gateway_payment(uuid,text,text,text,text,boolean,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.settle_gateway_payment(uuid,text,text,text,text,boolean,numeric,text,text,text) to service_role;
commit;
