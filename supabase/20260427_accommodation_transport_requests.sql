-- Safe production repair for Kagie accommodation and transport request persistence.
-- Run this after the profile/question paper migration, then reload the app.

create table if not exists public.accommodation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  listing_id text not null default '',
  property_name text not null default '',
  institution_name text not null default '',
  province text not null default '',
  location text not null default '',
  address text not null default '',
  room_type text not null default '',
  price numeric(10,2) not null default 0,
  learner_name text not null default '',
  learner_email text not null default '',
  learner_phone text not null default '',
  alternate_phone text not null default '',
  id_number text not null default '',
  student_number text not null default '',
  campus_name text not null default '',
  year_of_study text not null default '',
  gender text not null default '',
  preferred_move_in_date date,
  preferred_lease_months text not null default '',
  room_preference text not null default '',
  funding_status text not null default '',
  nsfas_beneficiary text not null default '',
  nsfas_since_year text not null default '',
  nsfas_reference_number text not null default '',
  nsfas_allowance_status text not null default '',
  bursary_provider text not null default '',
  guardian_name text not null default '',
  guardian_phone text not null default '',
  guardian_email text not null default '',
  emergency_contact_name text not null default '',
  emergency_contact_phone text not null default '',
  emergency_relationship text not null default '',
  documents_ready text not null default '',
  transport_needed text not null default '',
  special_needs text not null default '',
  medical_notes text not null default '',
  contact_phone text not null default '',
  note text not null default '',
  support_checklist jsonb not null default '[]'::jsonb,
  support_summary text not null default '',
  status text not null default 'Support review requested',
  provider_phone text not null default '',
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  assigned_assistant_id uuid references public.profiles(id) on delete set null,
  option_id text not null default '',
  trip_type text not null default 'One Way',
  company text not null default '',
  departure_city text not null default '',
  destination_city text not null default '',
  departure_time text not null default '',
  arrival_time text not null default '',
  travel_date date,
  return_date date,
  passengers text not null default '1',
  passenger_mix text not null default '',
  passenger_details jsonb not null default '[]'::jsonb,
  estimated_price numeric(10,2) not null default 0,
  support_fee numeric(10,2) not null default 0,
  note text not null default '',
  request_source_key text not null default '',
  payment_reference text not null default '',
  payment_method text not null default '',
  payment_amount numeric(10,2) not null default 0,
  paid_at timestamptz,
  ticket_code text not null default '',
  ticket_status text not null default 'Ticket sent',
  sent_at timestamptz,
  booked_by_user_id uuid references public.profiles(id) on delete set null,
  booked_by_role text not null default '',
  status text not null default 'Ticket sent',
  learner_name text not null default '',
  learner_email text not null default '',
  learner_phone text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_accommodation_requests_user_id
  on public.accommodation_requests(user_id);
create index if not exists idx_accommodation_requests_application_id
  on public.accommodation_requests(application_id);
create index if not exists idx_transport_requests_user_id
  on public.transport_requests(user_id);
create index if not exists idx_transport_requests_application_id
  on public.transport_requests(application_id);
create index if not exists idx_transport_requests_assistant_id
  on public.transport_requests(assigned_assistant_id);

drop trigger if exists set_accommodation_requests_updated_at on public.accommodation_requests;
create trigger set_accommodation_requests_updated_at
before update on public.accommodation_requests
for each row execute procedure public.set_updated_at();

drop trigger if exists set_transport_requests_updated_at on public.transport_requests;
create trigger set_transport_requests_updated_at
before update on public.transport_requests
for each row execute procedure public.set_updated_at();

alter table public.accommodation_requests enable row level security;
alter table public.transport_requests enable row level security;

drop policy if exists "accommodation_requests_self_or_staff" on public.accommodation_requests;
create policy "accommodation_requests_self_or_staff"
on public.accommodation_requests
for all
using (public.can_access_user(user_id))
with check (public.can_access_user(user_id));

drop policy if exists "transport_requests_self_or_staff" on public.transport_requests;
create policy "transport_requests_self_or_staff"
on public.transport_requests
for all
using (public.can_access_user(user_id))
with check (public.can_access_user(user_id));

notify pgrst, 'reload schema';
