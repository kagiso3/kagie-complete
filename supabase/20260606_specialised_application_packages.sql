-- Specialised application packages and form persistence.
-- Keeps the existing undergraduate application_packs flow intact.

alter table public.application_packs add column if not exists application_type text not null default 'UNDERGRADUATE';
alter table public.application_packs add column if not exists package_level text not null default 'STANDARD';
alter table public.application_packs add column if not exists features jsonb not null default '[]'::jsonb;
alter table public.application_packs add column if not exists is_popular boolean not null default false;
alter table public.application_packs add column if not exists is_premium boolean not null default false;

create table if not exists public.application_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  application_type text not null check (application_type in ('POST_GRADUATE', 'BRIDGING', 'TRANSFER')),
  package_name text not null,
  package_level text not null check (package_level in ('BASIC', 'STANDARD', 'PREMIUM')),
  price numeric(10,2) not null default 0,
  features jsonb not null default '[]'::jsonb,
  is_popular boolean not null default false,
  is_premium boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_addons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price numeric(10,2) not null default 0,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.applications add column if not exists application_type text not null default 'UNDERGRADUATE';
alter table public.applications add column if not exists selected_package_id uuid references public.application_packages(id) on delete set null;
alter table public.applications add column if not exists selected_addons jsonb not null default '[]'::jsonb;
alter table public.applications add column if not exists package_price numeric(10,2) not null default 0;
alter table public.applications add column if not exists addons_total numeric(10,2) not null default 0;
alter table public.applications add column if not exists final_total numeric(10,2) not null default 0;
alter table public.applications add column if not exists application_reference text not null default '';
alter table public.applications add column if not exists institution_choice_1 text not null default '';
alter table public.applications add column if not exists institution_choice_2 text not null default '';
alter table public.applications add column if not exists programme_choice text not null default '';
alter table public.applications add column if not exists application_payload jsonb not null default '{}'::jsonb;

create unique index if not exists idx_applications_reference_unique
  on public.applications(application_reference)
  where application_reference <> '';
create index if not exists idx_applications_type_status on public.applications(application_type, status);
create index if not exists idx_applications_selected_package on public.applications(selected_package_id);

alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check check (
  status in (
    'Draft',
    'Package Selected',
    'Awaiting Payment',
    'Paid',
    'Submitted',
    'Under Review',
    'Documents Missing',
    'Missing Documents',
    'Awaiting Institution Fee',
    'Submitted to Institution',
    'Ready to Apply',
    'Applied',
    'Pending Feedback',
    'Accepted',
    'Rejected',
    'Cancelled',
    'Application being processed'
  )
);

alter table public.applications drop constraint if exists applications_payment_status_check;
alter table public.applications add constraint applications_payment_status_check check (
  payment_status in (
    'Unpaid',
    'Pending',
    'Paid',
    'Failed',
    'Refunded',
    'Payment Pending',
    'Pending Verification',
    'Verified',
    'Rejected',
    'Cancelled'
  )
);

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (
  status in (
    'Unpaid',
    'Pending',
    'Paid',
    'Failed',
    'Refunded',
    'Payment Pending',
    'Pending Verification',
    'Verified',
    'Rejected',
    'Cancelled'
  )
);
alter table public.payments add column if not exists package_price numeric(10,2) not null default 0;
alter table public.payments add column if not exists addons_total numeric(10,2) not null default 0;
alter table public.payments add column if not exists final_total numeric(10,2) not null default 0;

create table if not exists public.application_selected_addons (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  addon_id uuid not null references public.application_addons(id) on delete restrict,
  price_at_selection numeric(10,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (application_id, addon_id)
);

create table if not exists public.application_payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  package_price numeric(10,2) not null default 0,
  addons_total numeric(10,2) not null default 0,
  final_total numeric(10,2) not null default 0,
  payment_status text not null default 'Unpaid' check (payment_status in ('Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded')),
  payment_method text not null default '',
  payment_reference text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create unique index if not exists idx_application_payments_application_unique
  on public.application_payments(application_id);

create table if not exists public.application_personal_details (
  application_id uuid primary key references public.applications(id) on delete cascade,
  full_name text not null default '',
  surname text not null default '',
  id_number text not null default '',
  passport_number text not null default '',
  date_of_birth date,
  gender text not null default '',
  nationality text not null default '',
  race text not null default '',
  home_language text not null default '',
  phone text not null default '',
  alternative_phone text not null default '',
  email text not null default '',
  residential_address text not null default '',
  province text not null default '',
  city text not null default '',
  postal_code text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_academic_details (
  application_id uuid primary key references public.applications(id) on delete cascade,
  school_name text not null default '',
  matric_year integer,
  highest_grade_completed text not null default '',
  current_institution text not null default '',
  previous_institution text not null default '',
  current_student_number text not null default '',
  qualification text not null default '',
  faculty text not null default '',
  academic_average numeric(6,2),
  nqf_level text not null default '',
  modules_completed text not null default '',
  modules_failed text not null default '',
  credits_completed numeric(10,2),
  credits_outstanding numeric(10,2),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.documents add column if not exists file_size bigint not null default 0;
alter table public.documents add column if not exists mime_type text not null default '';

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  old_status text not null default '',
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.record_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.application_status_history (
      application_id,
      old_status,
      new_status,
      changed_by
    ) values (
      new.id,
      coalesce(old.status, ''),
      new.status,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists record_application_status_change on public.applications;
create trigger record_application_status_change
after update of status on public.applications
for each row execute procedure public.record_application_status_change();

insert into public.application_packages (code, application_type, package_name, package_level, price, features, is_popular, is_premium)
values
  ('BRIDGING_BASIC', 'BRIDGING', 'Basic Bridging Package', 'BASIC', 150, '["1 bridging programme application","Document checklist","Basic form completion","Upload support","Application reference tracking"]', false, false),
  ('BRIDGING_STANDARD', 'BRIDGING', 'Standard Bridging Package', 'STANDARD', 300, '["Up to 2 institution applications","Subject marks review","Programme matching","Document review","Upload support","Submission tracking","Dashboard updates"]', true, false),
  ('BRIDGING_PREMIUM', 'BRIDGING', 'Premium Bridging Package', 'PREMIUM', 500, '["Up to 3 institution applications","Programme matching based on marks","Future qualification planning","Document review","Funding checklist","Accommodation/transport support option","Priority application tracking","Status updates"]', false, true),
  ('POSTGRADUATE_BASIC', 'POST_GRADUATE', 'Basic Post-Graduate Package', 'BASIC', 250, '["1 institution application","1 programme choice","Document checklist","Basic form completion","Upload of required documents","Application reference tracking"]', false, false),
  ('POSTGRADUATE_STANDARD', 'POST_GRADUATE', 'Standard Post-Graduate Package', 'STANDARD', 450, '["Up to 2 institution applications","Up to 3 programme choices","Document review before submission","CV checklist","Motivation letter structure/check","Application submission support","Reference number tracking","Status updates on Kagie dashboard"]', true, false),
  ('POSTGRADUATE_PREMIUM', 'POST_GRADUATE', 'Premium Post-Graduate Package', 'PREMIUM', 750, '["Up to 3 institution applications","Up to 5 programme choices","Full document review","CV review","Motivation letter improvement","Research proposal checklist","Supervisor/contact guidance","Application submission support","Priority tracking","Application status updates"]', false, true),
  ('TRANSFER_BASIC', 'TRANSFER', 'Basic Transfer Package', 'BASIC', 300, '["1 transfer application","Basic form completion","Document checklist","Upload support","Application reference tracking"]', false, false),
  ('TRANSFER_STANDARD', 'TRANSFER', 'Standard Transfer Package', 'STANDARD', 550, '["Up to 2 institution applications","Academic record review","Transfer reason/motivation checklist","Document review","Credit transfer document checklist","Submission support","Application tracking"]', true, false),
  ('TRANSFER_PREMIUM', 'TRANSFER', 'Premium Transfer Package', 'PREMIUM', 850, '["Up to 3 institution applications","Academic record review","Credit transfer checklist","Module outline checklist","Transfer motivation improvement","Document review before submission","Priority support","Status updates"]', false, true)
on conflict (code) do update set
  application_type = excluded.application_type,
  package_name = excluded.package_name,
  package_level = excluded.package_level,
  price = excluded.price,
  features = excluded.features,
  is_popular = excluded.is_popular,
  is_premium = excluded.is_premium,
  updated_at = timezone('utc', now());

insert into public.application_packs (
  code, name, price, institution_limit, is_unlimited, description, highlight,
  application_type, package_level, features, is_popular, is_premium
)
select
  code,
  package_name,
  price,
  case package_level when 'BASIC' then 1 when 'STANDARD' then 2 else 3 end,
  false,
  'Specialised Kagie application support package.',
  case when is_popular then 'Most Popular' when is_premium then 'Best Support' else '' end,
  application_type,
  package_level,
  features,
  is_popular,
  is_premium
from public.application_packages
on conflict (code) do update set
  name = excluded.name,
  price = excluded.price,
  institution_limit = excluded.institution_limit,
  application_type = excluded.application_type,
  package_level = excluded.package_level,
  features = excluded.features,
  is_popular = excluded.is_popular,
  is_premium = excluded.is_premium,
  updated_at = timezone('utc', now());

insert into public.application_addons (code, name, price, description)
values
  ('EXTRA_INSTITUTION_APPLICATION', 'Extra institution application', 100, 'Add one more institution application.'),
  ('EXTRA_PROGRAMME_CHOICE', 'Extra programme choice', 50, 'Add one more programme choice.'),
  ('MOTIVATION_LETTER_IMPROVEMENT', 'Motivation letter improvement', 150, 'Improve structure, clarity, and presentation.'),
  ('CV_IMPROVEMENT', 'CV improvement', 150, 'Review and improve an academic CV.'),
  ('RESEARCH_PROPOSAL_CHECKLIST', 'Research proposal checklist', 250, 'Check proposal sections and supporting requirements.'),
  ('DOCUMENT_SCANNING_COMPRESSING', 'Document scanning/compressing support', 80, 'Prepare documents for online submission.'),
  ('URGENT_PROCESSING', 'Urgent processing', 150, 'Prioritised Kagie processing support.'),
  ('NSFAS_GUIDANCE_SUPPORT', 'NSFAS guidance support', 100, 'Guidance on NSFAS application requirements.'),
  ('ACCOMMODATION_APPLICATION_SUPPORT', 'Accommodation application support', 100, 'Help prepare an accommodation request.'),
  ('TRANSPORT_BOOKING_SUPPORT', 'Transport booking support', 50, 'Help arrange transport after admission.'),
  ('APPLICATION_STATUS_FOLLOW_UP', 'Application status follow-up', 80, 'Additional application progress follow-up.')
on conflict (code) do update set
  name = excluded.name,
  price = excluded.price,
  description = excluded.description,
  updated_at = timezone('utc', now());

alter table public.application_packages enable row level security;
alter table public.application_addons enable row level security;
alter table public.application_selected_addons enable row level security;
alter table public.application_payments enable row level security;
alter table public.application_personal_details enable row level security;
alter table public.application_academic_details enable row level security;
alter table public.application_status_history enable row level security;

drop policy if exists "application_packages_read" on public.application_packages;
create policy "application_packages_read" on public.application_packages for select using (true);
drop policy if exists "application_addons_read" on public.application_addons;
create policy "application_addons_read" on public.application_addons for select using (true);
drop policy if exists "application_selected_addons_access" on public.application_selected_addons;
create policy "application_selected_addons_access" on public.application_selected_addons for all
using (public.can_access_application(application_id))
with check (public.can_access_application(application_id));
drop policy if exists "application_payments_access" on public.application_payments;
create policy "application_payments_access" on public.application_payments for all
using (public.can_access_application(application_id))
with check (public.can_access_application(application_id));
drop policy if exists "application_personal_details_access" on public.application_personal_details;
create policy "application_personal_details_access" on public.application_personal_details for all
using (public.can_access_application(application_id))
with check (public.can_access_application(application_id));
drop policy if exists "application_academic_details_access" on public.application_academic_details;
create policy "application_academic_details_access" on public.application_academic_details for all
using (public.can_access_application(application_id))
with check (public.can_access_application(application_id));
drop policy if exists "application_status_history_access" on public.application_status_history;
create policy "application_status_history_access" on public.application_status_history for select
using (public.can_access_application(application_id));

drop trigger if exists set_application_packages_updated_at on public.application_packages;
create trigger set_application_packages_updated_at before update on public.application_packages
for each row execute procedure public.set_updated_at();
drop trigger if exists set_application_addons_updated_at on public.application_addons;
create trigger set_application_addons_updated_at before update on public.application_addons
for each row execute procedure public.set_updated_at();
drop trigger if exists set_application_payments_updated_at on public.application_payments;
create trigger set_application_payments_updated_at before update on public.application_payments
for each row execute procedure public.set_updated_at();
drop trigger if exists set_application_personal_details_updated_at on public.application_personal_details;
create trigger set_application_personal_details_updated_at before update on public.application_personal_details
for each row execute procedure public.set_updated_at();
drop trigger if exists set_application_academic_details_updated_at on public.application_academic_details;
create trigger set_application_academic_details_updated_at before update on public.application_academic_details
for each row execute procedure public.set_updated_at();
