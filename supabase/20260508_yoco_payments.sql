-- Yoco Checkout payment hardening.
-- Run this once in Supabase SQL editor before enabling live Yoco payments.

alter table public.payments
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists provider text not null default '',
  add column if not exists gateway_checkout_id text,
  add column if not exists gateway_payment_id text,
  add column if not exists gateway_status text not null default '',
  add column if not exists currency text not null default 'ZAR',
  add column if not exists paid_at timestamptz,
  add column if not exists failure_reason text not null default '';

update public.payments p
set user_id = a.user_id
from public.applications a
where p.application_id = a.id
  and p.user_id is null;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (
  status in ('Payment Pending', 'Pending Verification', 'Verified', 'Rejected', 'Failed', 'Cancelled', 'Refunded')
);

alter table public.applications drop constraint if exists applications_payment_status_check;
alter table public.applications add constraint applications_payment_status_check check (
  payment_status in ('Payment Pending', 'Pending Verification', 'Verified', 'Rejected', 'Failed', 'Cancelled', 'Refunded')
);

create unique index if not exists idx_payments_gateway_checkout_unique
  on public.payments(gateway_checkout_id)
  where gateway_checkout_id is not null and gateway_checkout_id <> '';

create index if not exists idx_payments_user_created
  on public.payments(user_id, created_at desc);

create index if not exists idx_payments_application_created
  on public.payments(application_id, created_at desc);

create index if not exists idx_payments_provider_status_created
  on public.payments(provider, status, created_at desc);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  provider text not null default 'yoco',
  event_type text not null default '',
  payment_id uuid references public.payments(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  gateway_checkout_id text,
  gateway_payment_id text,
  processing_status text not null default 'processed' check (processing_status in ('processed', 'duplicate', 'ignored', 'error')),
  processing_error text not null default '',
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_payment_webhook_events_provider_created
  on public.payment_webhook_events(provider, created_at desc);

create index if not exists idx_payment_webhook_events_checkout
  on public.payment_webhook_events(gateway_checkout_id);

alter table public.payment_webhook_events enable row level security;

drop policy if exists "payment_webhook_events_staff_select" on public.payment_webhook_events;
create policy "payment_webhook_events_staff_select"
on public.payment_webhook_events
for select
using (public.is_staff());

-- Payment row access remains tied to the application owner/staff scope.
drop policy if exists "payments_self_or_staff" on public.payments;
create policy "payments_self_or_staff" on public.payments for select using (
  public.can_access_application(application_id)
);

drop policy if exists "payments_user_insert_or_staff" on public.payments;
create policy "payments_user_insert_or_staff" on public.payments for insert with check (
  public.can_access_application(application_id)
);

drop policy if exists "payments_staff_update" on public.payments;
create policy "payments_staff_update" on public.payments for update using (
  public.is_master_admin()
  or exists (select 1 from public.applications a where a.id = application_id and a.assistant_id = auth.uid())
) with check (
  public.is_master_admin()
  or exists (select 1 from public.applications a where a.id = application_id and a.assistant_id = auth.uid())
);
