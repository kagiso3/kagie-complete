-- Additive compatibility repair; reviewed against production metadata dated 2026-10-15.
-- LOCAL ONLY until backup, restore rehearsal, staging, and explicit production approval.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
revoke create on schema public from public, anon, authenticated;

-- Definition adapted from 20260426_admin_assignments_and_access.sql; no historical data rewriting.
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assistant_admin_id uuid not null references public.profiles(id) on delete cascade,
  master_admin_id uuid references public.profiles(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  status text not null default 'Assigned' check (
    status in ('Assigned', 'Reassigned', 'Unassigned', 'Completed')
  ),
  assigned_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint assignments_user_unique unique (user_id)
);

-- Definition adapted from 20260426_admin_assignments_and_access.sql; no historical data rewriting.
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Definition adapted from 20260508_master_admin_content_controls.sql; no historical data rewriting.
create table if not exists public.admin_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  title text not null default '',
  body text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Definition adapted from 20260508_master_admin_content_controls.sql; no historical data rewriting.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null default 'info',
  audience text not null default 'learners' check (audience in ('all', 'learners', 'assistants', 'institution')),
  institution_name text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Definition adapted from 20260521_master_admin_management_center.sql; no historical data rewriting.
create table if not exists public.career_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  body text not null default '',
  image_url text not null default '',
  file_url text not null default '',
  status text not null default 'draft' check (status in ('published', 'draft', 'archived')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Definition adapted from 20260521_master_admin_management_center.sql; no historical data rewriting.
create table if not exists public.housing_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  short_description text not null default '',
  description text not null default '',
  institution_id uuid references public.institutions(id) on delete set null,
  institution_name text not null default '',
  province text not null default '',
  city text not null default '',
  location text not null default '',
  address text not null default '',
  price numeric(10,2) not null default 0,
  price_range text not null default '',
  room_type text not null default '',
  availability_status text not null default 'Available',
  contact_phone text not null default '',
  contact_email text not null default '',
  images jsonb not null default '[]'::jsonb,
  listing_state text not null default 'draft' check (listing_state in ('published', 'draft', 'archived')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Definition adapted from 20260606_specialised_application_packages.sql; no historical data rewriting.
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

-- Definition adapted from 20260606_specialised_application_packages.sql; no historical data rewriting.
create table if not exists public.application_addons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price numeric(10,2) not null default 0,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Definition adapted from 20260606_specialised_application_packages.sql; no historical data rewriting.
create table if not exists public.application_selected_addons (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  addon_id uuid not null references public.application_addons(id) on delete restrict,
  price_at_selection numeric(10,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (application_id, addon_id)
);

-- Definition adapted from 20260606_specialised_application_packages.sql; no historical data rewriting.
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

-- Definition adapted from 20260606_specialised_application_packages.sql; no historical data rewriting.
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

-- Definition adapted from 20260606_specialised_application_packages.sql; no historical data rewriting.
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

-- Definition adapted from 20260606_specialised_application_packages.sql; no historical data rewriting.
create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  old_status text not null default '',
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

-- Definition adapted from 20260815_admin_permissions_updates_support.sql; no historical data rewriting.
create table if not exists public.application_form_types (
  form_type text primary key,
  label text not null,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Definition adapted from 20260815_admin_permissions_updates_support.sql; no historical data rewriting.
create table if not exists public.assistant_form_permissions (
  assistant_admin_id uuid not null references public.profiles(id) on delete cascade,
  form_type text not null references public.application_form_types(form_type) on delete cascade,
  enabled boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (assistant_admin_id, form_type)
);

-- Definition adapted from 20260815_admin_permissions_updates_support.sql; no historical data rewriting.
create table if not exists public.application_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  institution_name text not null default '',
  title text not null,
  message text not null,
  status text not null,
  action_label text not null default '',
  action_url text not null default '',
  is_read boolean not null default false,
  posted_by uuid references public.profiles(id) on delete set null,
  posted_by_role text not null default 'master_admin' check (posted_by_role in ('master_admin', 'assistant_admin')),
  update_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint application_updates_status_check check (
    status in (
      'Application Submitted',
      'Application Received',
      'Under Review',
      'Documents Required',
      'Application Updated',
      'Institution Response Received',
      'Provisionally Accepted',
      'Accepted',
      'Unsuccessful',
      'Waitlisted',
      'Registration Information Available'
    )
  )
);

-- Definition adapted from 20260427_accommodation_transport_requests.sql; no historical data rewriting.
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

-- Definition adapted from 20260427_accommodation_transport_requests.sql; no historical data rewriting.
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

-- Definition adapted from 20261004_staff_service_drafts.sql; no historical data rewriting.
create table if not exists public.assistant_service_permissions (
  assistant_admin_id uuid not null references public.profiles(id) on delete cascade,
  service_key text not null check (service_key in ('applications','support','updates','institutions','accommodation','cv','jobs','publish_jobs')),
  enabled boolean not null default false,
  granted_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (assistant_admin_id, service_key)
);

alter table public.application_institutions
  add column if not exists institution_id uuid references public.institutions(id) on delete set null;

alter table public.institutions
  add column if not exists city text not null default '',
  add column if not exists contact_email text not null default '',
  add column if not exists description text not null default '',
  add column if not exists logo text not null default '';

alter table public.announcements
  add column if not exists priority text not null default 'normal',
  add column if not exists scheduled_for timestamptz;

alter table public.application_packs add column if not exists application_type text not null default 'UNDERGRADUATE';

alter table public.application_packs add column if not exists package_level text not null default 'STANDARD';

alter table public.application_packs add column if not exists features jsonb not null default '[]'::jsonb;

alter table public.application_packs add column if not exists is_popular boolean not null default false;

alter table public.application_packs add column if not exists is_premium boolean not null default false;

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

alter table public.payments add column if not exists package_price numeric(10,2) not null default 0;

alter table public.payments add column if not exists addons_total numeric(10,2) not null default 0;

alter table public.payments add column if not exists final_total numeric(10,2) not null default 0;

alter table public.documents add column if not exists file_size bigint not null default 0;

alter table public.documents add column if not exists mime_type text not null default '';

alter table public.support_threads add column if not exists subject text not null default 'Support request';

alter table public.support_threads add column if not exists category text not null default 'General';

alter table public.support_threads add column if not exists priority text not null default 'normal';

alter table public.support_threads add column if not exists last_message_at timestamptz;

alter table public.support_threads add column if not exists closed_at timestamptz;

alter table public.support_messages add column if not exists attachment_url text not null default '';

alter table public.support_messages add column if not exists is_internal boolean not null default false;

alter table public.career_articles
  add column if not exists content_type text not null default 'article',
  add column if not exists company text not null default '',
  add column if not exists location text not null default '',
  add column if not exists work_mode text not null default '',
  add column if not exists employment_type text not null default '',
  add column if not exists category text not null default '',
  add column if not exists level text not null default '',
  add column if not exists closing_date text not null default '',
  add column if not exists start_date text not null default '',
  add column if not exists duration text not null default '',
  add column if not exists application_url text not null default '',
  add column if not exists tags text[] not null default '{}',
  add column if not exists requirements text[] not null default '{}';
alter table public.assignments add column if not exists id uuid primary key default gen_random_uuid();
alter table public.assignments add column if not exists user_id uuid not null references public.profiles(id) on delete cascade;
alter table public.assignments add column if not exists assistant_admin_id uuid not null references public.profiles(id) on delete cascade;
alter table public.assignments add column if not exists master_admin_id uuid references public.profiles(id) on delete set null;
alter table public.assignments add column if not exists application_id uuid references public.applications(id) on delete set null;
alter table public.assignments add column if not exists status text not null default 'Assigned';
alter table public.assignments add column if not exists assigned_at timestamptz not null default timezone('utc', now());
alter table public.assignments add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.assignments add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.activity_logs add column if not exists id uuid primary key default gen_random_uuid();
alter table public.activity_logs add column if not exists admin_id uuid references public.profiles(id) on delete set null;
alter table public.activity_logs add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.activity_logs add column if not exists application_id uuid references public.applications(id) on delete set null;
alter table public.activity_logs add column if not exists action text not null;
alter table public.activity_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.activity_logs add column if not exists timestamp timestamptz not null default timezone('utc', now());
alter table public.activity_logs add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.activity_logs add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.admin_content add column if not exists id uuid primary key default gen_random_uuid();
alter table public.admin_content add column if not exists content_key text not null unique;
alter table public.admin_content add column if not exists title text not null default '';
alter table public.admin_content add column if not exists body text not null default '';
alter table public.admin_content add column if not exists status text not null default 'active' check (status in ('active', 'inactive'));
alter table public.admin_content add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.admin_content add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.admin_content add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.admin_content add column if not exists created_at timestamptz not null default now();
alter table public.admin_content add column if not exists updated_at timestamptz not null default now();
alter table public.announcements add column if not exists id uuid primary key default gen_random_uuid();
alter table public.announcements add column if not exists title text not null;
alter table public.announcements add column if not exists message text not null;
alter table public.announcements add column if not exists type text not null default 'info';
alter table public.announcements add column if not exists audience text not null default 'learners' check (audience in ('all', 'learners', 'assistants', 'institution'));
alter table public.announcements add column if not exists institution_name text;
alter table public.announcements add column if not exists status text not null default 'active' check (status in ('active', 'inactive'));
alter table public.announcements add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.announcements add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.announcements add column if not exists created_at timestamptz not null default now();
alter table public.announcements add column if not exists updated_at timestamptz not null default now();
alter table public.career_articles add column if not exists id uuid primary key default gen_random_uuid();
alter table public.career_articles add column if not exists title text not null;
alter table public.career_articles add column if not exists summary text not null default '';
alter table public.career_articles add column if not exists body text not null default '';
alter table public.career_articles add column if not exists image_url text not null default '';
alter table public.career_articles add column if not exists file_url text not null default '';
alter table public.career_articles add column if not exists status text not null default 'draft' check (status in ('published', 'draft', 'archived'));
alter table public.career_articles add column if not exists published_at timestamptz;
alter table public.career_articles add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.career_articles add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.career_articles add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.career_articles add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.housing_listings add column if not exists id uuid primary key default gen_random_uuid();
alter table public.housing_listings add column if not exists title text not null;
alter table public.housing_listings add column if not exists short_description text not null default '';
alter table public.housing_listings add column if not exists description text not null default '';
alter table public.housing_listings add column if not exists institution_id uuid references public.institutions(id) on delete set null;
alter table public.housing_listings add column if not exists institution_name text not null default '';
alter table public.housing_listings add column if not exists province text not null default '';
alter table public.housing_listings add column if not exists city text not null default '';
alter table public.housing_listings add column if not exists location text not null default '';
alter table public.housing_listings add column if not exists address text not null default '';
alter table public.housing_listings add column if not exists price numeric(10,2) not null default 0;
alter table public.housing_listings add column if not exists price_range text not null default '';
alter table public.housing_listings add column if not exists room_type text not null default '';
alter table public.housing_listings add column if not exists availability_status text not null default 'Available';
alter table public.housing_listings add column if not exists contact_phone text not null default '';
alter table public.housing_listings add column if not exists contact_email text not null default '';
alter table public.housing_listings add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.housing_listings add column if not exists listing_state text not null default 'draft' check (listing_state in ('published', 'draft', 'archived'));
alter table public.housing_listings add column if not exists is_active boolean not null default true;
alter table public.housing_listings add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.housing_listings add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.housing_listings add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.housing_listings add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.application_packages add column if not exists id uuid primary key default gen_random_uuid();
alter table public.application_packages add column if not exists code text not null unique;
alter table public.application_packages add column if not exists application_type text not null check (application_type in ('POST_GRADUATE', 'BRIDGING', 'TRANSFER'));
alter table public.application_packages add column if not exists package_name text not null;
alter table public.application_packages add column if not exists package_level text not null check (package_level in ('BASIC', 'STANDARD', 'PREMIUM'));
alter table public.application_packages add column if not exists price numeric(10,2) not null default 0;
alter table public.application_packages add column if not exists features jsonb not null default '[]'::jsonb;
alter table public.application_packages add column if not exists is_popular boolean not null default false;
alter table public.application_packages add column if not exists is_premium boolean not null default false;
alter table public.application_packages add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_packages add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.application_addons add column if not exists id uuid primary key default gen_random_uuid();
alter table public.application_addons add column if not exists code text not null unique;
alter table public.application_addons add column if not exists name text not null;
alter table public.application_addons add column if not exists price numeric(10,2) not null default 0;
alter table public.application_addons add column if not exists description text not null default '';
alter table public.application_addons add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_addons add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.application_selected_addons add column if not exists id uuid primary key default gen_random_uuid();
alter table public.application_selected_addons add column if not exists application_id uuid not null references public.applications(id) on delete cascade;
alter table public.application_selected_addons add column if not exists addon_id uuid not null references public.application_addons(id) on delete restrict;
alter table public.application_selected_addons add column if not exists price_at_selection numeric(10,2) not null default 0;
alter table public.application_selected_addons add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_payments add column if not exists id uuid primary key default gen_random_uuid();
alter table public.application_payments add column if not exists application_id uuid not null references public.applications(id) on delete cascade;
alter table public.application_payments add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.application_payments add column if not exists package_price numeric(10,2) not null default 0;
alter table public.application_payments add column if not exists addons_total numeric(10,2) not null default 0;
alter table public.application_payments add column if not exists final_total numeric(10,2) not null default 0;
alter table public.application_payments add column if not exists payment_status text not null default 'Unpaid' check (payment_status in ('Unpaid', 'Pending', 'Paid', 'Failed', 'Refunded'));
alter table public.application_payments add column if not exists payment_method text not null default '';
alter table public.application_payments add column if not exists payment_reference text not null default '';
alter table public.application_payments add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_payments add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.application_personal_details add column if not exists application_id uuid primary key references public.applications(id) on delete cascade;
alter table public.application_personal_details add column if not exists full_name text not null default '';
alter table public.application_personal_details add column if not exists surname text not null default '';
alter table public.application_personal_details add column if not exists id_number text not null default '';
alter table public.application_personal_details add column if not exists passport_number text not null default '';
alter table public.application_personal_details add column if not exists date_of_birth date;
alter table public.application_personal_details add column if not exists gender text not null default '';
alter table public.application_personal_details add column if not exists nationality text not null default '';
alter table public.application_personal_details add column if not exists race text not null default '';
alter table public.application_personal_details add column if not exists home_language text not null default '';
alter table public.application_personal_details add column if not exists phone text not null default '';
alter table public.application_personal_details add column if not exists alternative_phone text not null default '';
alter table public.application_personal_details add column if not exists email text not null default '';
alter table public.application_personal_details add column if not exists residential_address text not null default '';
alter table public.application_personal_details add column if not exists province text not null default '';
alter table public.application_personal_details add column if not exists city text not null default '';
alter table public.application_personal_details add column if not exists postal_code text not null default '';
alter table public.application_personal_details add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_personal_details add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.application_academic_details add column if not exists application_id uuid primary key references public.applications(id) on delete cascade;
alter table public.application_academic_details add column if not exists school_name text not null default '';
alter table public.application_academic_details add column if not exists matric_year integer;
alter table public.application_academic_details add column if not exists highest_grade_completed text not null default '';
alter table public.application_academic_details add column if not exists current_institution text not null default '';
alter table public.application_academic_details add column if not exists previous_institution text not null default '';
alter table public.application_academic_details add column if not exists current_student_number text not null default '';
alter table public.application_academic_details add column if not exists qualification text not null default '';
alter table public.application_academic_details add column if not exists faculty text not null default '';
alter table public.application_academic_details add column if not exists academic_average numeric(6,2);
alter table public.application_academic_details add column if not exists nqf_level text not null default '';
alter table public.application_academic_details add column if not exists modules_completed text not null default '';
alter table public.application_academic_details add column if not exists modules_failed text not null default '';
alter table public.application_academic_details add column if not exists credits_completed numeric(10,2);
alter table public.application_academic_details add column if not exists credits_outstanding numeric(10,2);
alter table public.application_academic_details add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.application_academic_details add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_academic_details add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.application_status_history add column if not exists id uuid primary key default gen_random_uuid();
alter table public.application_status_history add column if not exists application_id uuid not null references public.applications(id) on delete cascade;
alter table public.application_status_history add column if not exists old_status text not null default '';
alter table public.application_status_history add column if not exists new_status text not null;
alter table public.application_status_history add column if not exists changed_by uuid references public.profiles(id) on delete set null;
alter table public.application_status_history add column if not exists note text not null default '';
alter table public.application_status_history add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_form_types add column if not exists form_type text primary key;
alter table public.application_form_types add column if not exists label text not null;
alter table public.application_form_types add column if not exists display_order integer not null default 100;
alter table public.application_form_types add column if not exists is_active boolean not null default true;
alter table public.application_form_types add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_form_types add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.assistant_form_permissions add column if not exists assistant_admin_id uuid not null references public.profiles(id) on delete cascade;
alter table public.assistant_form_permissions add column if not exists form_type text not null references public.application_form_types(form_type) on delete cascade;
alter table public.assistant_form_permissions add column if not exists enabled boolean not null default true;
alter table public.assistant_form_permissions add column if not exists granted_by uuid references public.profiles(id) on delete set null;
alter table public.assistant_form_permissions add column if not exists granted_at timestamptz not null default timezone('utc', now());
alter table public.assistant_form_permissions add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.application_updates add column if not exists id uuid primary key default gen_random_uuid();
alter table public.application_updates add column if not exists user_id uuid not null references public.profiles(id) on delete cascade;
alter table public.application_updates add column if not exists application_id uuid references public.applications(id) on delete cascade;
alter table public.application_updates add column if not exists institution_id uuid references public.institutions(id) on delete set null;
alter table public.application_updates add column if not exists institution_name text not null default '';
alter table public.application_updates add column if not exists title text not null;
alter table public.application_updates add column if not exists message text not null;
alter table public.application_updates add column if not exists status text not null;
alter table public.application_updates add column if not exists action_label text not null default '';
alter table public.application_updates add column if not exists action_url text not null default '';
alter table public.application_updates add column if not exists is_read boolean not null default false;
alter table public.application_updates add column if not exists posted_by uuid references public.profiles(id) on delete set null;
alter table public.application_updates add column if not exists posted_by_role text not null default 'master_admin' check (posted_by_role in ('master_admin', 'assistant_admin'));
alter table public.application_updates add column if not exists update_at timestamptz not null default timezone('utc', now());
alter table public.application_updates add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.application_updates add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.accommodation_requests add column if not exists id uuid primary key default gen_random_uuid();
alter table public.accommodation_requests add column if not exists user_id uuid not null references public.profiles(id) on delete cascade;
alter table public.accommodation_requests add column if not exists application_id uuid references public.applications(id) on delete set null;
alter table public.accommodation_requests add column if not exists listing_id text not null default '';
alter table public.accommodation_requests add column if not exists property_name text not null default '';
alter table public.accommodation_requests add column if not exists institution_name text not null default '';
alter table public.accommodation_requests add column if not exists province text not null default '';
alter table public.accommodation_requests add column if not exists location text not null default '';
alter table public.accommodation_requests add column if not exists address text not null default '';
alter table public.accommodation_requests add column if not exists room_type text not null default '';
alter table public.accommodation_requests add column if not exists price numeric(10,2) not null default 0;
alter table public.accommodation_requests add column if not exists learner_name text not null default '';
alter table public.accommodation_requests add column if not exists learner_email text not null default '';
alter table public.accommodation_requests add column if not exists learner_phone text not null default '';
alter table public.accommodation_requests add column if not exists alternate_phone text not null default '';
alter table public.accommodation_requests add column if not exists id_number text not null default '';
alter table public.accommodation_requests add column if not exists student_number text not null default '';
alter table public.accommodation_requests add column if not exists campus_name text not null default '';
alter table public.accommodation_requests add column if not exists year_of_study text not null default '';
alter table public.accommodation_requests add column if not exists gender text not null default '';
alter table public.accommodation_requests add column if not exists preferred_move_in_date date;
alter table public.accommodation_requests add column if not exists preferred_lease_months text not null default '';
alter table public.accommodation_requests add column if not exists room_preference text not null default '';
alter table public.accommodation_requests add column if not exists funding_status text not null default '';
alter table public.accommodation_requests add column if not exists nsfas_beneficiary text not null default '';
alter table public.accommodation_requests add column if not exists nsfas_since_year text not null default '';
alter table public.accommodation_requests add column if not exists nsfas_reference_number text not null default '';
alter table public.accommodation_requests add column if not exists nsfas_allowance_status text not null default '';
alter table public.accommodation_requests add column if not exists bursary_provider text not null default '';
alter table public.accommodation_requests add column if not exists guardian_name text not null default '';
alter table public.accommodation_requests add column if not exists guardian_phone text not null default '';
alter table public.accommodation_requests add column if not exists guardian_email text not null default '';
alter table public.accommodation_requests add column if not exists emergency_contact_name text not null default '';
alter table public.accommodation_requests add column if not exists emergency_contact_phone text not null default '';
alter table public.accommodation_requests add column if not exists emergency_relationship text not null default '';
alter table public.accommodation_requests add column if not exists documents_ready text not null default '';
alter table public.accommodation_requests add column if not exists transport_needed text not null default '';
alter table public.accommodation_requests add column if not exists special_needs text not null default '';
alter table public.accommodation_requests add column if not exists medical_notes text not null default '';
alter table public.accommodation_requests add column if not exists contact_phone text not null default '';
alter table public.accommodation_requests add column if not exists note text not null default '';
alter table public.accommodation_requests add column if not exists support_checklist jsonb not null default '[]'::jsonb;
alter table public.accommodation_requests add column if not exists support_summary text not null default '';
alter table public.accommodation_requests add column if not exists status text not null default 'Support review requested';
alter table public.accommodation_requests add column if not exists provider_phone text not null default '';
alter table public.accommodation_requests add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.accommodation_requests add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.accommodation_requests add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.transport_requests add column if not exists id uuid primary key default gen_random_uuid();
alter table public.transport_requests add column if not exists user_id uuid not null references public.profiles(id) on delete cascade;
alter table public.transport_requests add column if not exists application_id uuid references public.applications(id) on delete set null;
alter table public.transport_requests add column if not exists assigned_assistant_id uuid references public.profiles(id) on delete set null;
alter table public.transport_requests add column if not exists option_id text not null default '';
alter table public.transport_requests add column if not exists trip_type text not null default 'One Way';
alter table public.transport_requests add column if not exists company text not null default '';
alter table public.transport_requests add column if not exists departure_city text not null default '';
alter table public.transport_requests add column if not exists destination_city text not null default '';
alter table public.transport_requests add column if not exists departure_time text not null default '';
alter table public.transport_requests add column if not exists arrival_time text not null default '';
alter table public.transport_requests add column if not exists travel_date date;
alter table public.transport_requests add column if not exists return_date date;
alter table public.transport_requests add column if not exists passengers text not null default '1';
alter table public.transport_requests add column if not exists passenger_mix text not null default '';
alter table public.transport_requests add column if not exists passenger_details jsonb not null default '[]'::jsonb;
alter table public.transport_requests add column if not exists estimated_price numeric(10,2) not null default 0;
alter table public.transport_requests add column if not exists support_fee numeric(10,2) not null default 0;
alter table public.transport_requests add column if not exists note text not null default '';
alter table public.transport_requests add column if not exists request_source_key text not null default '';
alter table public.transport_requests add column if not exists payment_reference text not null default '';
alter table public.transport_requests add column if not exists payment_method text not null default '';
alter table public.transport_requests add column if not exists payment_amount numeric(10,2) not null default 0;
alter table public.transport_requests add column if not exists paid_at timestamptz;
alter table public.transport_requests add column if not exists ticket_code text not null default '';
alter table public.transport_requests add column if not exists ticket_status text not null default 'Ticket sent';
alter table public.transport_requests add column if not exists sent_at timestamptz;
alter table public.transport_requests add column if not exists booked_by_user_id uuid references public.profiles(id) on delete set null;
alter table public.transport_requests add column if not exists booked_by_role text not null default '';
alter table public.transport_requests add column if not exists status text not null default 'Ticket sent';
alter table public.transport_requests add column if not exists learner_name text not null default '';
alter table public.transport_requests add column if not exists learner_email text not null default '';
alter table public.transport_requests add column if not exists learner_phone text not null default '';
alter table public.transport_requests add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.transport_requests add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.assistant_service_permissions add column if not exists assistant_admin_id uuid not null references public.profiles(id) on delete cascade;
alter table public.assistant_service_permissions add column if not exists service_key text not null check (service_key in ('applications','support','updates','institutions','accommodation','cv','jobs','publish_jobs'));
alter table public.assistant_service_permissions add column if not exists enabled boolean not null default false;
alter table public.assistant_service_permissions add column if not exists granted_by uuid references public.profiles(id) on delete set null;
alter table public.assistant_service_permissions add column if not exists updated_at timestamptz not null default now();

alter table public.applications add column if not exists assigned_by uuid references public.profiles(id), add column if not exists assigned_at timestamptz, add column if not exists assignment_status text not null default 'Unassigned';
create table if not exists public.promo_campaigns(id uuid primary key default gen_random_uuid(),code text unique not null,description text not null default '',share_path text not null default '',title text not null default '',offer_note text not null default '',discount_kind text not null check(discount_kind in ('amount','percent','free_application_pack')),discount_value numeric not null default 0 check(discount_value>=0),max_uses integer not null default 0 check(max_uses>=0),used_count integer not null default 0,redeemed_user_ids jsonb not null default '[]',is_active boolean not null default true,created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create or replace function public.normalize_application_type(value text)
returns text
language sql
immutable
as $$
  select case
    when lower(regexp_replace(coalesce(value, ''), '[\s-]+', '_', 'g')) in ('late', 'late_application', 'late_applications') then 'late'
    when lower(regexp_replace(coalesce(value, ''), '[\s-]+', '_', 'g')) in ('bridging', 'bridge', 'bridging_programme', 'bridging_programmes') then 'bridging'
    when lower(regexp_replace(coalesce(value, ''), '[\s-]+', '_', 'g')) in ('postgraduate', 'post_graduate', 'post_graduate_application', 'post_graduate_applications', 'post_grad', 'postgrad') then 'postgraduate'
    when lower(regexp_replace(coalesce(value, ''), '[\s-]+', '_', 'g')) in ('transfer', 'transfer_application', 'transfer_applications') then 'transfer'
    when lower(regexp_replace(coalesce(value, ''), '[\s-]+', '_', 'g')) in ('undergraduate', 'undergrad', 'under_graduate', 'undergraduate_application', 'undergraduate_applications', 'under_graduate_application', 'under_graduate_applications') then 'undergraduate'
    else coalesce(nullif(lower(regexp_replace(coalesce(value, ''), '[\s-]+', '_', 'g')), ''), 'undergraduate')
  end;
$$;
create or replace function public.assistant_has_form_access(assistant_id uuid, form_type_arg text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.current_role()='master_admin' or
 (kagie_private.account_active() and public.current_role()='assistant_admin' and assistant_id=auth.uid() and
 coalesce((select enabled from public.assistant_form_permissions where assistant_admin_id=assistant_id and form_type=public.normalize_application_type(form_type_arg)),false));
$$;
alter table public.assistant_service_permissions enable row level security;
drop policy if exists assistant_services_read on public.assistant_service_permissions;
create policy assistant_services_read on public.assistant_service_permissions for select to authenticated
using (public.current_role() = 'master_admin' or assistant_admin_id = auth.uid());
drop policy if exists assistant_services_master_write on public.assistant_service_permissions;
create policy assistant_services_master_write on public.assistant_service_permissions for all to authenticated
using (public.current_role() = 'master_admin') with check (public.current_role() = 'master_admin');
drop trigger if exists set_assistant_service_permissions_updated_at on public.assistant_service_permissions;
create trigger set_assistant_service_permissions_updated_at before update on public.assistant_service_permissions
for each row execute procedure public.set_updated_at();

create or replace function public.assistant_has_service_access(assistant_id_arg uuid, key_arg text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare enabled_value boolean;
begin
  if assistant_id_arg is distinct from auth.uid() and public.current_role() <> 'master_admin' then return false; end if;
  if public.current_role() = 'master_admin' then return true; end if;
  if public.current_role() <> 'assistant_admin' then return false; end if;
  select enabled into enabled_value from public.assistant_service_permissions
    where assistant_admin_id = assistant_id_arg and service_key = key_arg;
  -- Preserve existing assigned-work access; privileged delegation is opt-in.
  return coalesce(enabled_value, key_arg in ('applications','support','updates','accommodation','cv','jobs'));
end;
$$;
revoke all on function public.assistant_has_service_access(uuid,text) from public;
grant execute on function public.assistant_has_service_access(uuid,text) to authenticated;

alter table public.assistant_service_permissions drop constraint if exists assistant_service_permissions_service_key_check;
alter table public.assistant_service_permissions add constraint assistant_service_permissions_service_key_check check(service_key in
 ('applications','support','updates','institutions','accommodation','cv','jobs','publish_jobs',
 'housing_create','housing_edit','housing_availability','housing_requests','housing_publish',
 'cv_edit','cv_message','cv_upload','cv_review','cv_complete','jobs_create','jobs_edit','jobs_submit','jobs_unpublish'));
create or replace function public.assistant_has_service_access(assistant_id_arg uuid,key_arg text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare allowed boolean; parent_key text;
begin
 if public.current_role()='master_admin' then return true; end if;
 if public.current_role()<>'assistant_admin' or assistant_id_arg is distinct from auth.uid() then return false; end if;
 select enabled into allowed from public.assistant_service_permissions where assistant_admin_id=assistant_id_arg and service_key=key_arg;
 if key_arg='institutions' then return coalesce(allowed,false); end if;
 parent_key:=case when key_arg='publish_jobs' then 'jobs' when key_arg like 'housing_%' then 'accommodation' when key_arg like 'cv_%' then 'cv' when key_arg like 'jobs_%' then 'jobs' else key_arg end;
 if key_arg<>parent_key then
   return coalesce(allowed,key_arg not in ('housing_publish','publish_jobs','jobs_unpublish')) and public.assistant_has_service_access(assistant_id_arg,parent_key);
 end if;
 return coalesce(allowed,key_arg in ('applications','support','updates','accommodation','cv','jobs'));
end; $$;

create table if not exists public.cv_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 source_document_id uuid unique references public.documents(id), assigned_assistant_id uuid references public.profiles(id),
 support_thread_id uuid references public.support_threads(id), final_document_id uuid references public.documents(id),
 career_goal text not null default '', learner_note text not null default '', next_question text not null default '',
 draft jsonb not null default '{}'::jsonb, internal_notes text not null default '',
 status text not null default 'New request' check(status in ('New request','Reviewing','Working','Waiting for learner','Ready for review','Ready to send','Completed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cv_versions (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.cv_requests(id),
 draft jsonb not null, status text not null, final_document_id uuid references public.documents(id),
 author_id uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index if not exists cv_requests_assistant_status on public.cv_requests(assigned_assistant_id,status);
create or replace function public.can_access_cv(target_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.cv_requests r where r.id=target_id and
 (public.current_role()='master_admin' or (public.current_role()='assistant_admin' and r.assigned_assistant_id=auth.uid() and public.assistant_has_service_access(auth.uid(),'cv'))));
$$;
-- Learners receive only the public request fields through this RPC, never internal notes.
create or replace function public.my_cv_requests() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'career_goal',career_goal,'next_question',next_question,'support_thread_id',support_thread_id,'final_document_id',final_document_id,'updated_at',updated_at)),'[]'::jsonb)
 from public.cv_requests where user_id=auth.uid();
$$;
revoke all on function public.my_cv_requests() from public;
grant execute on function public.my_cv_requests() to authenticated;
alter table public.cv_requests enable row level security;
alter table public.cv_versions enable row level security;
drop policy if exists cv_staff_read on public.cv_requests;
create policy cv_staff_read on public.cv_requests for select to authenticated using(public.can_access_cv(id));
drop policy if exists cv_staff_update on public.cv_requests;
create policy cv_staff_update on public.cv_requests for update to authenticated using(public.can_access_cv(id)) with check(public.can_access_cv(id));
drop policy if exists cv_versions_staff_read on public.cv_versions;
create policy cv_versions_staff_read on public.cv_versions for select to authenticated using(public.can_access_cv(request_id));
create or replace function public.guard_cv_request() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.current_role()<>'master_admin' then
   if new.user_id is distinct from old.user_id or new.assigned_assistant_id is distinct from old.assigned_assistant_id or new.source_document_id is distinct from old.source_document_id or new.support_thread_id is distinct from old.support_thread_id then raise exception 'Only Master Admin can assign CV requests'; end if;
   if new.draft is distinct from old.draft and not public.assistant_has_service_access(auth.uid(),'cv_edit') then raise exception 'CV editing is locked'; end if;
   if (new.internal_notes is distinct from old.internal_notes or new.next_question is distinct from old.next_question or new.career_goal is distinct from old.career_goal or new.status is distinct from old.status and new.status not in ('Ready for review','Completed')) and not public.assistant_has_service_access(auth.uid(),'cv_edit') then raise exception 'CV editing is locked'; end if;
   if new.final_document_id is distinct from old.final_document_id and not public.assistant_has_service_access(auth.uid(),'cv_upload') then raise exception 'CV delivery is locked'; end if;
   if new.status is distinct from old.status and new.status='Ready for review' and not public.assistant_has_service_access(auth.uid(),'cv_review') then raise exception 'CV review is locked'; end if;
   if new.status is distinct from old.status and new.status='Completed' and not public.assistant_has_service_access(auth.uid(),'cv_complete') then raise exception 'CV completion is locked'; end if;
 end if;
 if new.final_document_id is not null and not exists(select 1 from public.documents d where d.id=new.final_document_id and d.user_id=new.user_id and d.document_type='cv_revised') then raise exception 'The final CV must belong to this learner'; end if;
 if new.status in ('Ready to send','Completed') and new.final_document_id is null then raise exception 'Upload or generate the final CV first'; end if;
 new.updated_at:=now();
 return new;
end; $$;
drop trigger if exists guard_cv_request on public.cv_requests;
create trigger guard_cv_request before update on public.cv_requests for each row execute function public.guard_cv_request();
create or replace function public.cv_request_version() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.cv_versions(request_id,draft,status,final_document_id,author_id) values(new.id,new.draft,new.status,new.final_document_id,auth.uid());
 return new;
end; $$;
drop trigger if exists cv_request_version on public.cv_requests;
create trigger cv_request_version after insert or update on public.cv_requests for each row execute function public.cv_request_version();
create or replace function public.create_cv_request_from_document() returns trigger language plpgsql security definer set search_path=public as $$
declare thread_id uuid;
begin
 if new.document_type='cv' then
  insert into public.support_threads(user_id,category,subject,status) values(new.user_id,'Career Hub','CV Revamp: '||new.file_name,'open') returning id into thread_id;
  insert into public.cv_requests(user_id,source_document_id,support_thread_id,draft,career_goal,learner_note) values(new.user_id,new.id,thread_id,coalesce(new.metadata->'cvDraft','{}'::jsonb),coalesce(new.metadata#>>'{cvDraft,personal,title}',''),coalesce(new.metadata->>'learnerNote','')) on conflict(source_document_id) do nothing;
 end if;
 return new;
end; $$;
-- The existing document schema uses no structured metadata column; add one safely.
alter table public.documents add column if not exists metadata jsonb not null default '{}'::jsonb;
drop trigger if exists create_cv_request_from_document on public.documents;
create trigger create_cv_request_from_document after insert on public.documents for each row execute function public.create_cv_request_from_document();
-- Historical source CVs become unassigned review requests; preserve the originals.
-- Historical CV import is an explicit post-backup reconciliation step.

create or replace function public.can_access_application(target_application_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.applications a where a.id=target_application_id and
 (a.user_id=auth.uid() or public.current_role()='master_admin' or
 (public.current_role()='assistant_admin' and public.assistant_has_service_access(auth.uid(),'applications') and public.assistant_has_form_access(auth.uid(),a.application_type) and
 (a.assistant_id=auth.uid() or exists(select 1 from public.assignments s where s.user_id=a.user_id and s.assistant_admin_id=auth.uid())))));
$$;
-- INSERT ... RETURNING must authorize the new learner row directly. The stable
-- staff lookup can only see applications that existed before this statement.
drop policy if exists applications_self_or_staff on public.applications;
create policy applications_self_or_staff on public.applications for select
using (auth.uid() = user_id or public.can_access_application(id));
create or replace function public.can_access_user(target_user_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select target_user_id=auth.uid() or public.current_role()='master_admin' or (public.current_role()='assistant_admin' and (
 exists(select 1 from public.applications a where a.user_id=target_user_id and public.can_access_application(a.id)) or
 exists(select 1 from public.cv_requests r where r.user_id=target_user_id and public.can_access_cv(r.id)) or
 (public.assistant_has_service_access(auth.uid(),'support') and exists(select 1 from public.support_threads s where s.user_id=target_user_id and s.assistant_id=auth.uid())) or
 (public.assistant_has_service_access(auth.uid(),'support') and exists(select 1 from public.callback_requests c where c.user_id=target_user_id and c.assigned_assistant_id=auth.uid()))));
$$;
drop policy if exists application_notes_staff_boundary on public.application_notes;
create policy application_notes_staff_boundary on public.application_notes as restrictive for all to authenticated using(public.is_staff() and public.can_access_application(application_id)) with check(public.is_staff() and public.can_access_application(application_id) and author_id=auth.uid());
drop policy if exists support_internal_boundary on public.support_messages;
create policy support_internal_boundary on public.support_messages as restrictive for select to authenticated using(not is_internal or public.is_staff());
drop policy if exists support_sender_boundary on public.support_messages;
create policy support_sender_boundary on public.support_messages as restrictive for insert to authenticated with check(sender_id=auth.uid() and sender_role=public.current_role() and (not is_internal or public.is_staff()));
drop policy if exists support_threads_service_access on public.support_threads;
create policy support_threads_service_access on public.support_threads as restrictive for all to authenticated using(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support') or exists(select 1 from public.cv_requests r where r.support_thread_id=support_threads.id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message'))) with check(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support') or exists(select 1 from public.cv_requests r where r.support_thread_id=support_threads.id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message')));
drop policy if exists support_messages_service_access on public.support_messages;
create policy support_messages_service_access on public.support_messages as restrictive for all to authenticated using(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support') or exists(select 1 from public.cv_requests r where r.support_thread_id=support_messages.thread_id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message'))) with check(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support') or exists(select 1 from public.cv_requests r where r.support_thread_id=support_messages.thread_id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message')));
drop policy if exists review_author_boundary on public.document_reviews;
create policy review_author_boundary on public.document_reviews as restrictive for insert to authenticated with check(assistant_id=auth.uid());
drop policy if exists activity_actor_boundary on public.assistant_activity;
create policy activity_actor_boundary on public.assistant_activity as restrictive for insert to authenticated with check(assistant_id=auth.uid());
drop policy if exists housing_request_action_boundary on public.accommodation_requests;
create policy housing_request_action_boundary on public.accommodation_requests as restrictive for update to authenticated using(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'housing_requests')) with check(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'housing_requests'));
drop policy if exists notification_recipient_boundary on public.notifications;
create policy notification_recipient_boundary on public.notifications as restrictive for insert to authenticated with check(user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and public.can_access_user(user_id));
drop policy if exists document_record_boundary on public.documents;
create policy document_record_boundary on public.documents as restrictive for all to authenticated using(
 user_id=auth.uid() or public.current_role()='master_admin' or
 public.current_role()='assistant_admin' and (case when document_type like 'cv%' then exists(select 1 from public.cv_requests r where r.user_id=documents.user_id and public.can_access_cv(r.id)) else (application_id is not null and public.can_access_application(application_id) or application_id is null and public.can_access_user(user_id) and public.assistant_has_service_access(auth.uid(),'applications')) end)
) with check(user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and (
 document_type like 'cv%' and public.assistant_has_service_access(auth.uid(),'cv_upload') and exists(select 1 from public.cv_requests r where r.user_id=documents.user_id and public.can_access_cv(r.id)) or document_type not like 'cv%' and public.can_access_user(user_id) and (application_id is null or public.can_access_application(application_id))));
create or replace function public.can_access_cv_document(document_id_arg uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.documents d join public.cv_requests r on r.user_id=d.user_id where d.id=document_id_arg and public.can_access_cv(r.id) and
 (r.source_document_id=d.id or r.final_document_id=d.id or d.document_type='cv_revised' and d.metadata->>'cvRequestId'=r.id::text or exists(select 1 from public.cv_versions v where v.request_id=r.id and v.final_document_id=d.id)));
$$;
drop policy if exists cv_document_request_boundary on public.documents;
-- Use the candidate row directly: an INSERT ... RETURNING row is not yet visible
-- to a helper that queries documents again within the same statement snapshot.
create policy cv_document_request_boundary on public.documents as restrictive for select to authenticated using(document_type not like 'cv%' or user_id=auth.uid() or public.current_role()='master_admin' or exists(
 select 1 from public.cv_requests r where r.user_id=documents.user_id and public.can_access_cv(r.id) and (r.source_document_id=documents.id or r.final_document_id=documents.id or documents.document_type='cv_revised' and documents.metadata->>'cvRequestId'=r.id::text or exists(select 1 from public.cv_versions v where v.request_id=r.id and v.final_document_id=documents.id))));
drop policy if exists cv_document_write_boundary on public.documents;
create policy cv_document_write_boundary on public.documents as restrictive for insert to authenticated with check(document_type not like 'cv%' or user_id=auth.uid() or public.current_role()='master_admin' or document_type='cv_revised' and exists(select 1 from public.cv_requests r where r.user_id=documents.user_id and r.id::text=documents.metadata->>'cvRequestId' and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_upload')));
drop policy if exists support_work_boundary on public.support_threads;
create policy support_work_boundary on public.support_threads as restrictive for all to authenticated using(user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and (
 exists(select 1 from public.cv_requests r where r.support_thread_id=support_threads.id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message')) or
 public.assistant_has_service_access(auth.uid(),'support') and (assistant_id=auth.uid() or exists(select 1 from public.applications a where a.user_id=support_threads.user_id and public.can_access_application(a.id)))
)) with check(user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and (
 exists(select 1 from public.cv_requests r where r.support_thread_id=support_threads.id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message')) or
 public.assistant_has_service_access(auth.uid(),'support') and (assistant_id=auth.uid() or exists(select 1 from public.applications a where a.user_id=support_threads.user_id and public.can_access_application(a.id)))
));

alter table public.career_articles add column if not exists approval_state text not null default 'draft' check(approval_state in ('draft','submitted','approved','rejected'));
alter table public.career_articles add column if not exists submitted_at timestamptz;
alter table public.career_articles add column if not exists expires_at timestamptz;
alter table public.career_articles add column if not exists salary text not null default '';
alter table public.housing_listings add column if not exists assigned_assistant_id uuid references public.profiles(id);
alter table public.housing_listings add column if not exists deposit numeric(10,2) not null default 0;
alter table public.housing_listings add column if not exists rooms integer not null default 0;
alter table public.housing_listings add column if not exists amenities text[] not null default '{}';
alter table public.housing_listings add column if not exists available_from date;
create or replace function public.guard_staff_content() returns trigger language plpgsql security definer set search_path=public as $$
declare is_career boolean:=TG_TABLE_NAME='career_articles'; key_name text;
begin
 if auth.uid() is null then return new; end if;
 if public.current_role()='master_admin' then new.updated_by:=auth.uid(); return new; end if;
 if public.current_role()<>'assistant_admin' then raise exception 'Staff content is restricted'; end if;
 if TG_OP='INSERT' then
   new.created_by:=auth.uid(); key_name:=case when is_career then 'jobs_create' else 'housing_create' end;
   if not is_career then if new.assigned_assistant_id is not null then raise exception 'Only Master Admin assigns housing listings'; end if; end if;
 else
   if new.created_by is distinct from old.created_by then raise exception 'Content ownership cannot be changed'; end if;
   key_name:=case when is_career then 'jobs_edit' else 'housing_edit' end;
   if is_career then
     if old.status='published' and new.status='draft' and (to_jsonb(new)-array['status','approval_state','updated_at','updated_by']) is not distinct from (to_jsonb(old)-array['status','approval_state','updated_at','updated_by']) then key_name:='jobs_unpublish'; end if;
   end if;
   if not is_career then
     if (to_jsonb(new)-array['availability_status','updated_at','updated_by']) is not distinct from (to_jsonb(old)-array['availability_status','updated_at','updated_by']) then key_name:='housing_availability'; end if;
   end if;
   if not is_career then
     if new.assigned_assistant_id is distinct from old.assigned_assistant_id then raise exception 'Only Master Admin assigns housing listings'; end if;
   end if;
 end if;
 if not public.assistant_has_service_access(auth.uid(),key_name) then raise exception 'Content editing is locked'; end if;
 if is_career then
   if new.content_type not in ('job','internship') then raise exception 'Assistants can edit opportunities only'; end if;
   if new.approval_state='submitted' then
     if not public.assistant_has_service_access(auth.uid(),'jobs_submit') then raise exception 'Opportunity submission is locked'; end if;
     new.submitted_at:=now();
   elsif new.approval_state not in ('draft','submitted') then raise exception 'Only Master Admin reviews submitted opportunities'; end if;
   if new.status='published' and not public.assistant_has_service_access(auth.uid(),'publish_jobs') then raise exception 'Publication requires Master Admin approval'; end if;
   if TG_OP='UPDATE' and old.status='published' and new.status<>'published' and not public.assistant_has_service_access(auth.uid(),'jobs_unpublish') then raise exception 'Unpublishing is locked'; end if;
 else
   if TG_OP='INSERT' then
     if new.listing_state='published' and not public.assistant_has_service_access(auth.uid(),'housing_publish') then raise exception 'Housing publication is locked'; end if;
   elsif new.listing_state is distinct from old.listing_state and (new.listing_state='published' or old.listing_state='published') and not public.assistant_has_service_access(auth.uid(),'housing_publish') then raise exception 'Housing publication is locked'; end if;
   if TG_OP='UPDATE' and new.availability_status is distinct from old.availability_status and not public.assistant_has_service_access(auth.uid(),'housing_availability') then raise exception 'Housing availability is locked'; end if;
 end if;
 new.updated_by:=auth.uid(); return new;
end; $$;
drop trigger if exists guard_staff_content on public.career_articles;
create trigger guard_staff_content before insert or update on public.career_articles for each row execute function public.guard_staff_content();
drop trigger if exists guard_staff_content on public.housing_listings;
create trigger guard_staff_content before insert or update on public.housing_listings for each row execute function public.guard_staff_content();
drop policy if exists career_articles_assistant_draft_update on public.career_articles;
create policy career_articles_assistant_draft_update on public.career_articles for update to authenticated using(public.current_role()='assistant_admin' and created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'jobs') and (status='draft' and approval_state in ('draft','rejected') or public.assistant_has_service_access(auth.uid(),'publish_jobs') or status='published' and public.assistant_has_service_access(auth.uid(),'jobs_unpublish'))) with check(created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'jobs') and (status='draft' or status='published' and public.assistant_has_service_access(auth.uid(),'publish_jobs')));
drop policy if exists housing_listings_assistant_draft_update on public.housing_listings;
create policy housing_listings_assistant_draft_update on public.housing_listings for update to authenticated using(public.current_role()='assistant_admin' and (created_by=auth.uid() or assigned_assistant_id=auth.uid()) and public.assistant_has_service_access(auth.uid(),'accommodation')) with check(public.current_role()='assistant_admin' and (created_by=auth.uid() or assigned_assistant_id=auth.uid()) and public.assistant_has_service_access(auth.uid(),'accommodation'));
drop policy if exists housing_listings_assistant_draft_insert on public.housing_listings;
create policy housing_listings_assistant_draft_insert on public.housing_listings for insert to authenticated with check(public.current_role()='assistant_admin' and created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'housing_create') and (listing_state='draft' or listing_state='published' and public.assistant_has_service_access(auth.uid(),'housing_publish')));
drop policy if exists housing_assistant_visibility on public.housing_listings;
create policy housing_assistant_visibility on public.housing_listings for select to authenticated using(public.current_role()='assistant_admin' and assigned_assistant_id=auth.uid() and public.assistant_has_service_access(auth.uid(),'accommodation'));
drop policy if exists housing_draft_scope on public.housing_listings;
create policy housing_draft_scope on public.housing_listings as restrictive for select to authenticated using(public.current_role()<>'assistant_admin' or listing_state='published' or public.assistant_has_service_access(auth.uid(),'accommodation') and (created_by=auth.uid() or assigned_assistant_id=auth.uid()));
-- Expired opportunities disappear even if a background expiry job is unavailable.
drop policy if exists career_expiry on public.career_articles;
create policy career_expiry on public.career_articles as restrictive for select using(public.is_staff() or expires_at is null or expires_at>now());

create or replace function public.guard_application_staff_fields() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.current_role()<>'master_admin' then
   if TG_OP='UPDATE' and (new.assistant_id is distinct from old.assistant_id or new.user_id is distinct from old.user_id or new.assigned_by is distinct from old.assigned_by) then raise exception 'Only Master Admin assigns applications'; end if;
   if TG_OP='UPDATE' and public.current_role()='assistant_admin' and new.application_type is distinct from old.application_type then raise exception 'Only Master Admin can change an application form type'; end if;
   if TG_OP='INSERT' and new.assistant_id is not null then raise exception 'Only Master Admin assigns applications'; end if;
   if public.current_role()='assistant_admin' and new.payment_status is distinct from old.payment_status then raise exception 'Only Master Admin reviews payments'; end if;
   if public.current_role()='user' and new.payment_status in ('Verified','Rejected','Refunded') and (TG_OP='INSERT' or new.payment_status is distinct from old.payment_status) then raise exception 'Payment review is restricted'; end if;
 end if;
 if auth.uid() is not null and public.current_role()='master_admin' and new.assistant_id is not null and (TG_OP='INSERT' or new.assistant_id is distinct from old.assistant_id) then
   if not exists(select 1 from public.profiles p where p.id=new.assistant_id and exists(select 1 from auth.users u where u.id=p.id and u.raw_app_meta_data->>'role'='assistant_admin' and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) and coalesce(p.is_active,true)) or
      not coalesce((select enabled from public.assistant_form_permissions where assistant_admin_id=new.assistant_id and form_type=public.normalize_application_type(new.application_type)),not exists(select 1 from public.assistant_form_permissions where assistant_admin_id=new.assistant_id)) then raise exception 'Choose an assistant with access to this form'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_application_staff_fields on public.applications;
create trigger guard_application_staff_fields before insert or update on public.applications for each row execute function public.guard_application_staff_fields();

-- Restrictive policies still apply if older permissive storage policies remain installed.
create or replace function public.can_read_kagie_file(path_arg text) returns boolean language sql stable security definer set search_path=public as $$
 select public.current_role()='master_admin' or
 split_part(path_arg,'/',1)=auth.uid()::text or
 -- These existing namespaces contain public learning resources, never learner uploads.
 path_arg ~ '^prospectus/[A-Za-z0-9_-]+/[^/]+\.pdf$' or path_arg='past-papers/catalog.json' or
 path_arg ~ '^past-papers/.+\.pdf$' and not exists(select 1 from public.question_papers q where (q.remote_path=path_arg or q.file_url=path_arg) and lower(q.status)<>'published') or
 exists(select 1 from public.documents d where d.file_url=path_arg and
 (d.user_id=auth.uid() or public.current_role()='assistant_admin' and (case when d.document_type like 'cv%' then public.can_access_cv_document(d.id) else public.assistant_has_service_access(auth.uid(),'applications') and (d.application_id is not null and public.can_access_application(d.application_id) or d.application_id is null and public.can_access_user(d.user_id)) end))) or
 exists(select 1 from public.career_articles c where (c.image_url=path_arg or c.file_url=path_arg) and (c.status='published' and (c.expires_at is null or c.expires_at>now()) or c.created_by=auth.uid() and public.current_role()='assistant_admin' and public.assistant_has_service_access(auth.uid(),'jobs'))) or
 exists(select 1 from public.housing_listings h where h.images ? path_arg and (h.listing_state='published' and h.is_active or public.current_role()='assistant_admin' and public.assistant_has_service_access(auth.uid(),'accommodation') and (h.created_by=auth.uid() or h.assigned_assistant_id=auth.uid()))) or
 exists(select 1 from public.question_papers q where (q.remote_path=path_arg or q.file_url=path_arg) and lower(q.status)='published');
$$;
create or replace function public.can_write_kagie_file(path_arg text) returns boolean language sql stable security definer set search_path=public as $$
 select public.current_role()='master_admin' or
 (not exists(select 1 from public.career_articles c where (c.image_url=path_arg or c.file_url=path_arg) and (c.status='published' or c.approval_state='submitted') and not (c.created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'publish_jobs'))) and
 not exists(select 1 from public.housing_listings h where h.images ? path_arg and h.listing_state='published' and not ((h.created_by=auth.uid() or h.assigned_assistant_id=auth.uid()) and public.assistant_has_service_access(auth.uid(),'housing_publish'))) and
 (split_part(path_arg,'/',1)=auth.uid()::text or
 public.current_role()='assistant_admin' and (
 path_arg like 'career-hub/image/'||auth.uid()||'/%' and (public.assistant_has_service_access(auth.uid(),'jobs_create') or public.assistant_has_service_access(auth.uid(),'jobs_edit')) or
 path_arg like 'housing/'||auth.uid()||'/%' and (public.assistant_has_service_access(auth.uid(),'housing_create') or public.assistant_has_service_access(auth.uid(),'housing_edit')) or
 not exists(select 1 from public.documents d where d.file_url=path_arg) and exists(select 1 from public.cv_requests r where split_part(path_arg,'/',1)=r.user_id::text and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_upload')))));
$$;
drop policy if exists kagie_file_read_boundary on storage.objects;
create policy kagie_file_read_boundary on storage.objects as restrictive for select using(bucket_id<>'kagie-documents' or public.can_read_kagie_file(name));
drop policy if exists kagie_file_insert_boundary on storage.objects;
create policy kagie_file_insert_boundary on storage.objects as restrictive for insert with check(bucket_id<>'kagie-documents' or public.can_write_kagie_file(name));
drop policy if exists kagie_file_update_boundary on storage.objects;
create policy kagie_file_update_boundary on storage.objects as restrictive for update using(bucket_id<>'kagie-documents' or public.can_write_kagie_file(name)) with check(bucket_id<>'kagie-documents' or public.can_write_kagie_file(name));
revoke all on function public.can_read_kagie_file(text),public.can_write_kagie_file(text),public.can_access_cv(uuid) from public;
grant execute on function public.can_read_kagie_file(text),public.can_write_kagie_file(text),public.can_access_cv(uuid) to authenticated;
grant select,update on public.cv_requests to authenticated;
grant select on public.cv_versions to authenticated;

create table if not exists public.payment_reviews(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications(id),reviewer_id uuid references public.profiles(id),status text not null,reason text not null default '',created_at timestamptz not null default now());
alter table public.payment_reviews enable row level security;
drop policy if exists payment_review_read on public.payment_reviews;
create policy payment_review_read on public.payment_reviews for select to authenticated using(public.can_access_application(application_id));
drop policy if exists payment_review_insert on public.payment_reviews;
create policy payment_review_insert on public.payment_reviews for insert to authenticated with check(public.current_role()='master_admin' and reviewer_id=auth.uid());
grant select,insert on public.payment_reviews to authenticated;
create or replace function public.staff_review_payment(application_id_arg uuid,status_arg text,reason_arg text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare result public.applications;
begin
 if public.current_role()<>'master_admin' then raise exception 'Only Master Admin reviews payments'; end if;
 if status_arg not in ('Pending Verification','Verified','Rejected') or status_arg='Rejected' and trim(coalesce(reason_arg,''))='' then raise exception 'Choose a decision and provide a rejection reason'; end if;
 update public.applications set payment_status=status_arg where id=application_id_arg returning * into result;
 if result.id is null then raise exception 'Application unavailable'; end if;
 insert into public.payment_reviews(application_id,reviewer_id,status,reason) values(application_id_arg,auth.uid(),status_arg,reason_arg);
 return jsonb_build_object('id',result.id,'payment_status',result.payment_status);
end; $$;
create or replace function public.staff_review_document(document_id_arg uuid,status_arg text,note_arg text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare result public.documents;
begin
 if not public.is_staff() or status_arg not in ('Pending Review','Approved','Rejected') or status_arg='Rejected' and trim(coalesce(note_arg,''))='' then raise exception 'Staff review and a useful rejection reason are required'; end if;
 update public.documents set status=status_arg where id=document_id_arg returning * into result;
 if result.id is null then raise exception 'Document unavailable or access denied'; end if;
 insert into public.document_reviews(document_id,assistant_id,status,note) values(document_id_arg,auth.uid(),status_arg,note_arg);
 insert into public.notifications(user_id,title,message,notification_type) values(result.user_id,'Document reviewed',result.file_name||': '||status_arg||case when note_arg<>'' then '. '||note_arg else '' end,'info');
 return jsonb_build_object('id',result.id,'status',result.status);
end; $$;
revoke all on function public.staff_review_payment(uuid,text,text),public.staff_review_document(uuid,text,text) from public;
grant execute on function public.staff_review_payment(uuid,text,text),public.staff_review_document(uuid,text,text) to authenticated;
drop policy if exists payment_master_write_boundary on public.payments;
create policy payment_master_write_boundary on public.payments as restrictive for update to authenticated using(public.current_role()='master_admin') with check(public.current_role()='master_admin');

create or replace function public.staff_audit_mutation() returns trigger language plpgsql security definer set search_path=public as $$
declare target_app uuid;
begin
 if auth.uid() is not null and public.is_staff() then
   if TG_TABLE_NAME='applications' then target_app:=new.id;
   elsif TG_TABLE_NAME in ('application_notes','application_updates','payment_reviews') then target_app:=new.application_id;
   end if;
   insert into public.assistant_activity(assistant_id,application_id,action,details) values(auth.uid(),target_app,lower(TG_OP)||'_'||TG_TABLE_NAME,jsonb_build_object('recordId',coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'assistant_admin_id')));
 end if;
 return new;
end; $$;
do $$ declare table_name text; begin
 foreach table_name in array array['applications','application_notes','application_updates','documents','document_reviews','callback_requests','career_articles','housing_listings','cv_requests','payment_reviews','assistant_form_permissions','assistant_service_permissions'] loop
   execute format('drop trigger if exists staff_audit_mutation on public.%I',table_name);
   execute format('create trigger staff_audit_mutation after insert or update on public.%I for each row execute function public.staff_audit_mutation()',table_name);
 end loop;
end; $$;
create or replace function public.staff_capabilities() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 return jsonb_build_object('migration','20261004b','role',public.current_role(),'document_bucket',exists(select 1 from storage.buckets where id='kagie-documents' and not public), 'cv_requests',to_regclass('public.cv_requests') is not null,'private_file_policies',(select count(*)=3 from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('kagie_file_read_boundary','kagie_file_insert_boundary','kagie_file_update_boundary')));
end; $$;
create or replace function public.staff_save_portal(application_id_arg uuid,entries_arg jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare payload jsonb; result_id uuid;
begin
 if not public.is_staff() or not public.can_access_application(application_id_arg) then raise exception 'Application unavailable or access denied'; end if;
 if jsonb_typeof(entries_arg)<>'array' then raise exception 'Portal entries must be an array'; end if;
 select coalesce(application_payload,'{}'::jsonb) into payload from public.applications where id=application_id_arg for update;
 payload:=jsonb_set(payload,'{forms}',coalesce(payload->'forms','{}'::jsonb),true);
 payload:=jsonb_set(payload,'{forms,portalAccess}',entries_arg,true);
 update public.applications set application_payload=payload where id=application_id_arg returning id into result_id;
 if result_id is null then raise exception 'Application unavailable'; end if;
 insert into public.application_notes(application_id,author_id,author_role,note) values(application_id_arg,auth.uid(),public.current_role(),'__KAGIE_PORTAL_ACCESS__'||jsonb_build_object('entries',entries_arg)::text);
 return jsonb_build_object('id',result_id);
end; $$;
create or replace function public.cv_delivery_notice() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status in ('Ready to send','Completed') and new.status is distinct from old.status then
 insert into public.notifications(user_id,title,message,notification_type) values(new.user_id,'Your revised CV is ready','Your final CV is available in Documents. Open your CV support conversation for feedback.','info');
 end if;return new;
end; $$;
drop trigger if exists cv_delivery_notice on public.cv_requests;
create trigger cv_delivery_notice after update on public.cv_requests for each row execute function public.cv_delivery_notice();
create or replace function public.staff_start_cv_conversation(request_id_arg uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare r public.cv_requests; thread_id uuid;
begin
 if public.current_role()<>'master_admin' then raise exception 'Only Master Admin can link historical CV conversations'; end if;
 select * into r from public.cv_requests where id=request_id_arg for update;
 if r.id is null then raise exception 'CV request unavailable'; end if;
 if r.support_thread_id is not null then return r.support_thread_id; end if;
 insert into public.support_threads(user_id,category,subject,status) values(r.user_id,'Career Hub','CV Revamp conversation','open') returning id into thread_id;
 update public.cv_requests set support_thread_id=thread_id where id=r.id;
 return thread_id;
end; $$;
revoke all on function public.staff_capabilities(),public.staff_save_portal(uuid,jsonb),public.staff_start_cv_conversation(uuid) from public;
grant execute on function public.staff_capabilities(),public.staff_save_portal(uuid,jsonb),public.staff_start_cv_conversation(uuid) to authenticated;
revoke all on function public.can_access_cv_document(uuid) from public;
grant execute on function public.can_access_cv_document(uuid) to authenticated;

-- Seed missing catalog entries only; preserve all existing pricing/configuration.
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
on conflict (code) do nothing;

-- Seed missing catalog entries only; preserve all existing pricing/configuration.
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
on conflict (code) do nothing;

-- Seed missing catalog entries only; preserve all existing pricing/configuration.
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
on conflict (code) do nothing;

insert into public.application_form_types(form_type,label,display_order) values('undergraduate','Undergraduate Applications',10),('bridging','Bridging Programmes',20),('transfer','Transfer Applications',30),('postgraduate','Postgraduate Applications',40),('late','Late Applications',50) on conflict(form_type) do nothing;

-- Reviewed policy supplement embedded into the versioned compatibility migration.
-- This is test/build source, never a stand-alone production deployment script.
create or replace function public.assistant_has_form_access(assistant_id uuid, form_type_arg text)
returns boolean language sql stable security definer set search_path='' as $$
 select public.current_role()='master_admin' or
 (kagie_private.account_active() and public.current_role()='assistant_admin' and assistant_id=auth.uid() and
 coalesce((select enabled from public.assistant_form_permissions where assistant_admin_id=assistant_id and form_type=public.normalize_application_type(form_type_arg)),false));
$$;
-- Permissions are explicit, including for newly provisioned assistants. Only a
-- master can grant them. Existing assignment records and profiles are retained.
create or replace function public.assistant_has_service_access(assistant_id_arg uuid,key_arg text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare allowed boolean; parent_key text;
begin
 if public.current_role()='master_admin' then return true; end if;
 if not kagie_private.account_active() or public.current_role()<>'assistant_admin' or assistant_id_arg is distinct from auth.uid() then return false; end if;
 select enabled into allowed from public.assistant_service_permissions where assistant_admin_id=assistant_id_arg and service_key=key_arg;
 parent_key:=case when key_arg='publish_jobs' then 'jobs' when key_arg like 'housing_%' then 'accommodation' when key_arg like 'cv_%' then 'cv' when key_arg like 'jobs_%' then 'jobs' else key_arg end;
 if key_arg<>parent_key then return coalesce(allowed,false) and public.assistant_has_service_access(assistant_id_arg,parent_key); end if;
 return coalesce(allowed,false);
end; $$;
create or replace function public.can_access_application(target_application_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select kagie_private.account_active() and exists(select 1 from public.applications a where a.id=target_application_id and
 (a.user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and
 public.assistant_has_service_access(auth.uid(),'applications') and public.assistant_has_form_access(auth.uid(),a.application_type) and
 (a.assistant_id=auth.uid() or exists(select 1 from public.assistant_assignments s where s.user_id=a.user_id and s.assistant_admin_id=auth.uid()) or
 exists(select 1 from public.assignments s where s.user_id=a.user_id and s.assistant_admin_id=auth.uid() and s.status in ('Assigned','Reassigned')))));
$$;
create or replace function kagie_private.can_access_application(target_application_id uuid)
returns boolean language sql stable security definer set search_path='' as $$ select public.can_access_application(target_application_id); $$;
create or replace function kagie_private.staff_can_access_user(target_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select kagie_private.account_active() and (public.current_role()='master_admin' or public.current_role()='assistant_admin' and (
 exists(select 1 from public.applications a where a.user_id=target_user_id and public.can_access_application(a.id)) or
 exists(select 1 from public.cv_requests r where r.user_id=target_user_id and public.can_access_cv(r.id)) or
 public.assistant_has_service_access(auth.uid(),'support') and (
 exists(select 1 from public.support_threads t where t.user_id=target_user_id and t.assistant_id=auth.uid()) or
 exists(select 1 from public.callback_requests c where c.user_id=target_user_id and c.assigned_assistant_id=auth.uid()))));
$$;
create or replace function public.can_access_user(target_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$ select kagie_private.can_access_user(target_user_id); $$;
create or replace function kagie_private.can_read_file(path_arg text)
returns boolean language sql stable security definer set search_path='' as $$ select kagie_private.account_active() and public.can_read_kagie_file(path_arg); $$;
create or replace function kagie_private.can_write_file(path_arg text)
returns boolean language sql stable security definer set search_path='' as $$ select kagie_private.account_active() and path_arg !~ '(^|/)\.\.(/|$)' and public.can_write_kagie_file(path_arg); $$;

-- New tables have explicit grants and RLS, independent of project defaults.
do $$ declare t text; begin
 foreach t in array array['assignments','admin_content','announcements','career_articles','housing_listings','application_packages','application_addons','application_selected_addons','application_payments','application_personal_details','application_academic_details','application_status_history','application_form_types','assistant_form_permissions','application_updates','assistant_service_permissions','promo_campaigns'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('drop policy if exists repair_master on public.%I',t);
  execute format('create policy repair_master on public.%I for all to authenticated using(public.current_role()=''master_admin'') with check(public.current_role()=''master_admin'')',t);
 end loop;
 foreach t in array array['application_personal_details','application_academic_details','application_selected_addons'] loop
  execute format('drop policy if exists repair_application_scope on public.%I',t);
  execute format('create policy repair_application_scope on public.%I for all to authenticated using(public.can_access_application(application_id)) with check(public.can_access_application(application_id))',t);
 end loop;
 foreach t in array array['application_payments','application_status_history'] loop
  execute format('drop policy if exists repair_application_read on public.%I',t);
  execute format('create policy repair_application_read on public.%I for select to authenticated using(public.can_access_application(application_id))',t);
 end loop;
 foreach t in array array['assistant_form_permissions','assistant_service_permissions'] loop
  execute format('drop policy if exists repair_own_permissions on public.%I',t);
  execute format('create policy repair_own_permissions on public.%I for select to authenticated using(kagie_private.account_active() and assistant_admin_id=auth.uid())',t);
 end loop;
 foreach t in array array['application_packages','application_addons','application_form_types'] loop
  execute format('drop policy if exists repair_catalog_read on public.%I',t);
  execute format('create policy repair_catalog_read on public.%I for select to authenticated using(kagie_private.account_active())',t);
 end loop;
end; $$;
drop policy if exists repair_assignment_self on public.assignments;
create policy repair_assignment_self on public.assignments for select to authenticated using(public.current_role()='assistant_admin' and assistant_admin_id=auth.uid());
drop policy if exists repair_content_read on public.admin_content;
create policy repair_content_read on public.admin_content for select to authenticated using(kagie_private.account_active() and status='active');
drop policy if exists repair_announcement_read on public.announcements;
create policy repair_announcement_read on public.announcements for select to authenticated using(kagie_private.account_active() and status='active' and (scheduled_for is null or scheduled_for<=now()) and (audience='all' or audience='learners' and public.current_role()='user' or audience='assistants' and public.current_role()='assistant_admin'));
drop policy if exists repair_career_read on public.career_articles;
create policy repair_career_read on public.career_articles for select to authenticated using(kagie_private.account_active() and (status='published' and (expires_at is null or expires_at>now()) or created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'jobs')));
drop policy if exists repair_housing_read on public.housing_listings;
create policy repair_housing_read on public.housing_listings for select to authenticated using(kagie_private.account_active() and (listing_state='published' and is_active or (created_by=auth.uid() or assigned_assistant_id=auth.uid()) and public.assistant_has_service_access(auth.uid(),'accommodation')));
drop policy if exists repair_career_insert on public.career_articles;
create policy repair_career_insert on public.career_articles for insert to authenticated with check(public.assistant_has_service_access(auth.uid(),'jobs_create') and created_by=auth.uid());
drop policy if exists repair_update_read on public.application_updates;
create policy repair_update_read on public.application_updates for select to authenticated using(kagie_private.account_active() and (user_id=auth.uid() or public.can_access_application(application_id)));
drop policy if exists repair_update_write on public.application_updates;
create policy repair_update_write on public.application_updates for insert to authenticated with check(public.is_staff() and public.assistant_has_service_access(auth.uid(),'updates') and public.can_access_application(application_id) and posted_by=auth.uid() and posted_by_role=public.current_role() and exists(select 1 from public.applications a where a.id=application_id and a.user_id=application_updates.user_id));
drop policy if exists repair_update_ack on public.application_updates;
create policy repair_update_ack on public.application_updates for update to authenticated using(kagie_private.account_active() and user_id=auth.uid()) with check(user_id=auth.uid());
create or replace function kagie_private.guard_application_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if public.current_role()='user' and (to_jsonb(new)-array['is_read','updated_at']) is distinct from (to_jsonb(old)-array['is_read','updated_at']) then raise exception 'Only read acknowledgement may change' using errcode='42501'; end if;
 return new;
end; $$;
drop trigger if exists repair_update_guard on public.application_updates;
create trigger repair_update_guard before update on public.application_updates for each row execute function kagie_private.guard_application_update();
-- Payments and reconciliation history are retained even when a user deletes a draft.
drop policy if exists repair_payment_no_delete on public.payments;
create policy repair_payment_no_delete on public.payments as restrictive for delete to authenticated using(false);
drop policy if exists repair_paid_application_no_delete on public.applications;
create policy repair_paid_application_no_delete on public.applications as restrictive for delete to authenticated using(payment_status not in ('Verified','Paid','Refunded') and not exists(select 1 from public.payments p where p.application_id=applications.id));
-- Private-object DELETE needs a restrictive boundary, too, including legacy grants.
drop policy if exists repair_file_delete on storage.objects;
create policy repair_file_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'kagie-documents' or kagie_private.can_write_file(name));

-- Atomic replacement validates every row before deletion; errors roll back the
-- transaction. Service-role API callers must supply the authenticated owner ID.
create or replace function public.replace_application_marks(p_application_id uuid,p_owner_id uuid,p_marks jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.applications; m jsonb; n integer:=0;
begin
 select * into a from public.applications where id=p_application_id for update;
 if a.id is null or a.user_id is distinct from p_owner_id or
 (current_setting('role',true)<>'service_role' and (not kagie_private.account_active() or auth.uid() is distinct from p_owner_id)) then raise exception 'Application unavailable' using errcode='42501'; end if;
 if a.status not in ('Draft','Package Selected','Awaiting Payment','Pending Details','Incomplete') then raise exception 'Application marks are locked' using errcode='42501'; end if;
 if jsonb_typeof(p_marks) is distinct from 'array' or jsonb_array_length(p_marks)>40 then raise exception 'Invalid marks' using errcode='22023'; end if;
 for m in select value from jsonb_array_elements(p_marks) loop
  if jsonb_typeof(m)<>'object' or length(trim(coalesce(m->>'subject','')))=0 or length(m->>'subject')>200 or
   coalesce(m->>'percent','') !~ '^\d{1,3}$' or (m->>'percent')::integer not between 0 and 100 or
   coalesce(m->>'level','') !~ '^[1-7]$' then raise exception 'Invalid subject or mark' using errcode='22023'; end if;
 end loop;
 delete from public.application_marks where application_id=a.id;
 insert into public.application_marks(application_id,subject,percent,level) select a.id,trim(value->>'subject'),(value->>'percent')::integer,(value->>'level')::integer from jsonb_array_elements(p_marks);
 get diagnostics n=row_count;
 update public.applications set updated_at=now() where id=a.id;
 return n;
end; $$;
revoke all on function public.replace_application_marks(uuid,uuid,jsonb) from public,anon;
grant execute on function public.replace_application_marks(uuid,uuid,jsonb) to authenticated,service_role;
revoke all on function public.assistant_has_form_access(uuid,text),public.can_access_application(uuid),public.can_access_user(uuid),public.normalize_application_type(text) from public;
grant execute on function public.assistant_has_form_access(uuid,text),public.can_access_application(uuid),public.can_access_user(uuid),public.normalize_application_type(text) to authenticated,service_role;
revoke truncate,references,trigger on all tables in schema public from anon,authenticated;

commit;
notify pgrst,'reload schema';
