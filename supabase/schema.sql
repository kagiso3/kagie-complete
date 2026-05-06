create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('assistant_admin', 'master_admin');
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid unique,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  id_number text not null default '',
  province text not null default '',
  city text not null default '',
  role text not null default 'user' check (role in ('user', 'assistant_admin', 'master_admin')),
  profile_image text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles add column if not exists user_id uuid;
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists id_number text not null default '';
alter table public.profiles add column if not exists province text not null default '';
alter table public.profiles add column if not exists city text not null default '';
update public.profiles set user_id = id where user_id is null;
create unique index if not exists profiles_user_id_unique_idx on public.profiles(user_id);

create table if not exists public.user_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  id_number text not null default '',
  surname text not null default '',
  maiden_name text not null default '',
  date_of_birth date,
  gender text not null default '',
  home_language text not null default '',
  province text not null default '',
  postal_code text not null default '',
  address text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.guardian_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  relation text not null default '',
  guardian_id text not null default '',
  full_names text not null default '',
  surname text not null default '',
  phone_1 text not null default '',
  phone_2 text not null default '',
  email text not null default '',
  province text not null default '',
  postal_code text not null default '',
  address text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.school_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  school_name text not null default '',
  confirm_name text not null default '',
  school_province text not null default '',
  school_type text not null default '',
  completion_year integer,
  average numeric(5,2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_packs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price numeric(10,2) not null default 0,
  institution_limit integer,
  is_unlimited boolean not null default false,
  description text not null default '',
  highlight text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null default '',
  province text not null default '',
  type text not null default '',
  website text not null default '',
  notes text not null default '',
  logo text not null default '',
  year text not null default extract(year from timezone('utc', now()))::text,
  application_fee numeric(10,2) not null default 0,
  application_fee_label text not null default '',
  application_fee_note text not null default '',
  opening_date date,
  closing_date date,
  manual_status text not null default '' check (manual_status in ('', 'open', 'closing_soon', 'closed')),
  is_active boolean not null default true,
  faculties jsonb not null default '[]'::jsonb,
  course_entry_mode text not null default 'manual' check (course_entry_mode in ('manual', 'guided')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.institutions add column if not exists website text not null default '';
alter table public.institutions add column if not exists notes text not null default '';

with duplicate_institutions as (
  select
    id,
    row_number() over (
      partition by lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
      order by is_active desc, updated_at desc, created_at desc, id
    ) as rn
  from public.institutions
)
delete from public.institutions i
using duplicate_institutions d
where i.id = d.id and d.rn > 1;

drop index if exists public.institutions_unique_name_type_idx;
create unique index if not exists institutions_unique_name_idx
  on public.institutions (
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  );

create table if not exists public.promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  discount_kind text not null default 'percent' check (
    discount_kind in ('percent', 'amount', 'free_application_pack')
  ),
  discount_value numeric(10,2) not null default 0,
  offer_note text not null default '',
  max_uses integer not null default 0,
  used_count integer not null default 0,
  redeemed_user_ids jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  share_path text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

  create table if not exists public.question_papers (
    id uuid primary key default gen_random_uuid(),
    grade text not null,
  subject text not null,
  title text not null,
  year integer not null check (year between 2010 and 2026),
  term text not null default '',
  province text not null default 'National',
  paper_type text not null check (paper_type in ('Question Paper', 'Memo', 'Study Guide')),
  file_name text not null default '',
  file_url text not null default '',
  remote_path text not null default '',
  status text not null default 'Draft' check (status in ('Published', 'Draft', 'Disabled')),
  uploaded_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
  );

  create table if not exists public.accommodation_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    application_id uuid,
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
    application_id uuid,
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

  create table if not exists public.applications (
    id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assistant_id uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz,
  assignment_status text not null default 'Unassigned' check (
    assignment_status in ('Assigned', 'Reassigned', 'Unassigned')
  ),
  package_id uuid references public.application_packs(id) on delete set null,
  status text not null default 'Draft' check (
    status in (
      'Draft',
      'Submitted',
      'Under Review',
      'Missing Documents',
      'Ready to Apply',
      'Applied',
      'Pending Feedback',
      'Accepted',
      'Rejected',
      'Application being processed'
    )
  ),
  payment_status text not null default 'Payment Pending' check (
    payment_status in ('Payment Pending', 'Pending Verification', 'Verified')
  ),
  payer_name text not null default '',
  payer_phone text not null default '',
  payment_reference text not null default '',
  payment_method text not null default '',
  payment_note text not null default '',
  payment_amount numeric(10,2) not null default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.applications add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.applications add column if not exists assigned_at timestamptz;
alter table public.applications add column if not exists assignment_status text not null default 'Unassigned';
alter table public.applications drop constraint if exists applications_assignment_status_check;
alter table public.applications add constraint applications_assignment_status_check check (
  assignment_status in ('Assigned', 'Reassigned', 'Unassigned')
);

create table if not exists public.application_marks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  subject text not null,
  percent integer not null check (percent between 0 and 100),
  level integer not null check (level between 1 and 7),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_institutions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  province text not null default '',
  institution_type text not null default '',
  institution_name text not null default '',
  application_fee numeric(10,2) not null default 0,
  application_fee_label text not null default '',
  application_fee_note text not null default '',
  faculty text not null default '',
  choice_1 text not null default '',
  choice_2 text not null default '',
  choice_3 text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.application_institutions add column if not exists application_fee numeric(10,2) not null default 0;
alter table public.application_institutions add column if not exists application_fee_label text not null default '';
alter table public.application_institutions add column if not exists application_fee_note text not null default '';

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  total_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  item_type text not null check (item_type in ('application_pack', 'service', 'institution', 'custom')),
  ref_id uuid,
  name text not null,
  price numeric(10,2) not null default 0,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  payer_name text not null,
  phone text not null,
  reference text not null,
  method text not null,
  note text not null default '',
  amount numeric(10,2) not null default 0,
  status text not null default 'Pending Verification' check (
    status in ('Payment Pending', 'Pending Verification', 'Verified')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  document_type text not null,
  file_name text not null,
  file_url text not null,
  status text not null default 'Pending Review' check (
    status in ('Pending Review', 'Approved', 'Rejected')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.document_reviews (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  assistant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('Pending Review', 'Approved', 'Rejected')),
  note text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assistant_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'assistant_admin', 'master_admin')),
  message text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_assistant_id uuid references public.profiles(id) on delete set null,
  phone text not null,
  preferred_time text not null default '',
  note text not null default '',
  status text not null default 'Pending' check (
    status in ('Pending', 'Contacted', 'Resolved')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_role text not null check (author_role in ('user', 'assistant_admin', 'master_admin')),
  note text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assistant_activity (
  id uuid primary key default gen_random_uuid(),
  assistant_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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

  alter table public.accommodation_requests drop constraint if exists accommodation_requests_application_id_fkey;
  alter table public.accommodation_requests
    add constraint accommodation_requests_application_id_fkey
    foreign key (application_id) references public.applications(id) on delete set null;

  alter table public.transport_requests drop constraint if exists transport_requests_application_id_fkey;
  alter table public.transport_requests
    add constraint transport_requests_application_id_fkey
    foreign key (application_id) references public.applications(id) on delete set null;

create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'master_admin';
$$;

create or replace function public.can_access_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = target_user_id
    or public.is_master_admin()
    or exists (
      select 1 from public.applications a
      where a.user_id = target_user_id and a.assistant_id = auth.uid()
    )
    or exists (
      select 1 from public.assignments ass
      where ass.user_id = target_user_id and ass.assistant_admin_id = auth.uid()
    )
    or exists (
      select 1 from public.support_threads st
      where st.user_id = target_user_id and st.assistant_id = auth.uid()
    )
    or exists (
      select 1 from public.callback_requests cr
      where cr.user_id = target_user_id and cr.assigned_assistant_id = auth.uid()
    );
$$;

create or replace function public.can_access_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.applications a
    where a.id = target_application_id
      and (
        a.user_id = auth.uid()
        or public.is_master_admin()
        or a.assistant_id = auth.uid()
        or exists (
          select 1 from public.assignments ass
          where ass.user_id = a.user_id and ass.assistant_admin_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, full_name, email, role)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data ->> 'role', 'user')
    )
    on conflict (id) do nothing;
  exception when others then
    raise log 'profiles insert failed for %: %', new.id, sqlerrm;
  end;

  begin
    insert into public.user_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    raise log 'user_profiles insert failed for %: %', new.id, sqlerrm;
  end;

  begin
    insert into public.guardian_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    raise log 'guardian_profiles insert failed for %: %', new.id, sqlerrm;
  end;

  begin
    insert into public.school_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    raise log 'school_profiles insert failed for %: %', new.id, sqlerrm;
  end;

  begin
    insert into public.carts (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    raise log 'carts insert failed for %: %', new.id, sqlerrm;
  end;

  begin
    if coalesce(new.raw_user_meta_data ->> 'role', 'user') = 'user' then
      insert into public.applications (user_id)
      values (new.id);
    end if;
  exception when others then
    raise log 'applications insert failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_auth_user();

create or replace function public.seed_default_packs()
returns void
language plpgsql
as $$
begin
  insert into public.application_packs (code, name, price, institution_limit, is_unlimited, description, highlight)
  values
    ('launch', '10 Institution Pack', 250, 10, false, 'Apply to up to 10 institutions with guided form completion, shortlist support, and Kagie tracking in one place.', 'Best value for a strong first shortlist'),
    ('growth', '15 Institution Pack', 350, 15, false, 'Apply to up to 15 universities, colleges, and TVET institutions while keeping your draft, documents, and support aligned.', 'Balanced choice for wider national coverage'),
    ('premium', '20 Institution Pack', 450, 20, false, 'Apply to up to 20 institutions with broader coverage, stronger planning room, and premium Kagie guidance.', 'Built for ambitious applicants targeting many options'),
    ('concierge', 'Unlimited Pack', 800, null, true, 'Apply to as many institutions as you need with unlimited shortlist coverage and close Kagie support across the cycle.', 'Maximum reach with full Kagie support')
  on conflict (code) do update
  set
    name = excluded.name,
    price = excluded.price,
    institution_limit = excluded.institution_limit,
    is_unlimited = excluded.is_unlimited,
    description = excluded.description,
    highlight = excluded.highlight,
    updated_at = timezone('utc', now());
end;
$$;

select public.seed_default_packs();

alter table public.applications drop constraint if exists applications_payment_status_check;
alter table public.applications add constraint applications_payment_status_check check (
  payment_status in ('Payment Pending', 'Pending Verification', 'Verified', 'Rejected')
);

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (
  status in ('Payment Pending', 'Pending Verification', 'Verified', 'Rejected')
);

create index if not exists idx_applications_user_id on public.applications(user_id);
create index if not exists idx_applications_assistant_id on public.applications(assistant_id);
create index if not exists idx_promo_campaigns_code on public.promo_campaigns(code);
create index if not exists idx_application_marks_application_id on public.application_marks(application_id);
create index if not exists idx_application_institutions_application_id on public.application_institutions(application_id);
create index if not exists idx_cart_items_cart_id on public.cart_items(cart_id);
create index if not exists idx_documents_user_id on public.documents(user_id);
create index if not exists idx_documents_application_id on public.documents(application_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_support_threads_user_id on public.support_threads(user_id);
create index if not exists idx_support_messages_thread_id on public.support_messages(thread_id);
create index if not exists idx_callback_requests_user_id on public.callback_requests(user_id);
create index if not exists idx_application_notes_application_id on public.application_notes(application_id);
create index if not exists idx_assistant_activity_assistant_id on public.assistant_activity(assistant_id);
create index if not exists idx_assignments_user_id on public.assignments(user_id);
create index if not exists idx_assignments_assistant_admin_id on public.assignments(assistant_admin_id);
create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
  create index if not exists idx_activity_logs_admin_id on public.activity_logs(admin_id);
  create index if not exists idx_activity_logs_timestamp on public.activity_logs(timestamp desc);
  create index if not exists idx_question_papers_lookup on public.question_papers(grade, subject, year, term, status);
  create index if not exists idx_question_papers_status on public.question_papers(status);
  create index if not exists idx_accommodation_requests_user_id on public.accommodation_requests(user_id);
  create index if not exists idx_accommodation_requests_application_id on public.accommodation_requests(application_id);
  create index if not exists idx_transport_requests_user_id on public.transport_requests(user_id);
  create index if not exists idx_transport_requests_application_id on public.transport_requests(application_id);
  create index if not exists idx_transport_requests_assistant_id on public.transport_requests(assigned_assistant_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at before update on public.user_profiles for each row execute procedure public.set_updated_at();
drop trigger if exists set_guardian_profiles_updated_at on public.guardian_profiles;
create trigger set_guardian_profiles_updated_at before update on public.guardian_profiles for each row execute procedure public.set_updated_at();
drop trigger if exists set_school_profiles_updated_at on public.school_profiles;
create trigger set_school_profiles_updated_at before update on public.school_profiles for each row execute procedure public.set_updated_at();
drop trigger if exists set_application_packs_updated_at on public.application_packs;
create trigger set_application_packs_updated_at before update on public.application_packs for each row execute procedure public.set_updated_at();
drop trigger if exists set_institutions_updated_at on public.institutions;
create trigger set_institutions_updated_at before update on public.institutions for each row execute procedure public.set_updated_at();
drop trigger if exists set_promo_campaigns_updated_at on public.promo_campaigns;
create trigger set_promo_campaigns_updated_at before update on public.promo_campaigns for each row execute procedure public.set_updated_at();
drop trigger if exists set_applications_updated_at on public.applications;
create trigger set_applications_updated_at before update on public.applications for each row execute procedure public.set_updated_at();
drop trigger if exists set_application_marks_updated_at on public.application_marks;
create trigger set_application_marks_updated_at before update on public.application_marks for each row execute procedure public.set_updated_at();
drop trigger if exists set_application_institutions_updated_at on public.application_institutions;
create trigger set_application_institutions_updated_at before update on public.application_institutions for each row execute procedure public.set_updated_at();
drop trigger if exists set_carts_updated_at on public.carts;
create trigger set_carts_updated_at before update on public.carts for each row execute procedure public.set_updated_at();
drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at before update on public.cart_items for each row execute procedure public.set_updated_at();
drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at before update on public.payments for each row execute procedure public.set_updated_at();
drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at before update on public.documents for each row execute procedure public.set_updated_at();
drop trigger if exists set_document_reviews_updated_at on public.document_reviews;
create trigger set_document_reviews_updated_at before update on public.document_reviews for each row execute procedure public.set_updated_at();
drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at before update on public.notifications for each row execute procedure public.set_updated_at();
drop trigger if exists set_support_threads_updated_at on public.support_threads;
create trigger set_support_threads_updated_at before update on public.support_threads for each row execute procedure public.set_updated_at();
drop trigger if exists set_support_messages_updated_at on public.support_messages;
create trigger set_support_messages_updated_at before update on public.support_messages for each row execute procedure public.set_updated_at();
drop trigger if exists set_callback_requests_updated_at on public.callback_requests;
create trigger set_callback_requests_updated_at before update on public.callback_requests for each row execute procedure public.set_updated_at();
drop trigger if exists set_application_notes_updated_at on public.application_notes;
create trigger set_application_notes_updated_at before update on public.application_notes for each row execute procedure public.set_updated_at();
drop trigger if exists set_assistant_activity_updated_at on public.assistant_activity;
create trigger set_assistant_activity_updated_at before update on public.assistant_activity for each row execute procedure public.set_updated_at();
drop trigger if exists set_assignments_updated_at on public.assignments;
create trigger set_assignments_updated_at before update on public.assignments for each row execute procedure public.set_updated_at();
drop trigger if exists set_activity_logs_updated_at on public.activity_logs;
create trigger set_activity_logs_updated_at before update on public.activity_logs for each row execute procedure public.set_updated_at();
  drop trigger if exists set_question_papers_updated_at on public.question_papers;
  create trigger set_question_papers_updated_at before update on public.question_papers for each row execute procedure public.set_updated_at();
  drop trigger if exists set_accommodation_requests_updated_at on public.accommodation_requests;
  create trigger set_accommodation_requests_updated_at before update on public.accommodation_requests for each row execute procedure public.set_updated_at();
  drop trigger if exists set_transport_requests_updated_at on public.transport_requests;
  create trigger set_transport_requests_updated_at before update on public.transport_requests for each row execute procedure public.set_updated_at();

  alter table public.profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.guardian_profiles enable row level security;
alter table public.school_profiles enable row level security;
alter table public.application_packs enable row level security;
alter table public.institutions enable row level security;
alter table public.promo_campaigns enable row level security;
alter table public.applications enable row level security;
alter table public.application_marks enable row level security;
alter table public.application_institutions enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.document_reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.callback_requests enable row level security;
alter table public.application_notes enable row level security;
alter table public.assistant_activity enable row level security;
  alter table public.assignments enable row level security;
  alter table public.activity_logs enable row level security;
  alter table public.question_papers enable row level security;
  alter table public.accommodation_requests enable row level security;
  alter table public.transport_requests enable row level security;

drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff" on public.profiles for select using (
  auth.uid() = id or public.is_master_admin() or public.can_access_user(id)
);
drop policy if exists "profiles_update_self_or_master" on public.profiles;
create policy "profiles_update_self_or_master" on public.profiles for update using (auth.uid() = id or public.current_role() = 'master_admin');
drop policy if exists "profiles_insert_self_or_master" on public.profiles;
create policy "profiles_insert_self_or_master" on public.profiles for insert with check (auth.uid() = id or public.current_role() = 'master_admin');

drop policy if exists "user_profiles_self_or_staff" on public.user_profiles;
create policy "user_profiles_self_or_staff" on public.user_profiles for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));
drop policy if exists "guardian_profiles_self_or_staff" on public.guardian_profiles;
create policy "guardian_profiles_self_or_staff" on public.guardian_profiles for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));
drop policy if exists "school_profiles_self_or_staff" on public.school_profiles;
create policy "school_profiles_self_or_staff" on public.school_profiles for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));

drop policy if exists "application_packs_public_read" on public.application_packs;
create policy "application_packs_public_read" on public.application_packs for select using (true);
drop policy if exists "application_packs_master_write" on public.application_packs;
create policy "application_packs_master_write" on public.application_packs for all using (public.current_role() = 'master_admin') with check (public.current_role() = 'master_admin');

drop policy if exists "institutions_public_read" on public.institutions;
create policy "institutions_public_read" on public.institutions for select using (true);
drop policy if exists "institutions_master_write" on public.institutions;
create policy "institutions_master_write" on public.institutions for all using (public.current_role() = 'master_admin') with check (public.current_role() = 'master_admin');

drop policy if exists "question_papers_published_read" on public.question_papers;
create policy "question_papers_published_read" on public.question_papers for select using (
  status = 'Published' or public.current_role() in ('assistant_admin', 'master_admin')
);
  drop policy if exists "question_papers_master_write" on public.question_papers;
  create policy "question_papers_master_write" on public.question_papers for all using (
    public.current_role() = 'master_admin'
  ) with check (
    public.current_role() = 'master_admin'
  );

  drop policy if exists "accommodation_requests_self_or_staff" on public.accommodation_requests;
  create policy "accommodation_requests_self_or_staff" on public.accommodation_requests for all using (
    public.can_access_user(user_id)
  ) with check (
    public.can_access_user(user_id)
  );

  drop policy if exists "transport_requests_self_or_staff" on public.transport_requests;
  create policy "transport_requests_self_or_staff" on public.transport_requests for all using (
    public.can_access_user(user_id)
  ) with check (
    public.can_access_user(user_id)
  );

drop policy if exists "promo_campaigns_public_read" on public.promo_campaigns;
create policy "promo_campaigns_public_read" on public.promo_campaigns for select using (true);
drop policy if exists "promo_campaigns_master_write" on public.promo_campaigns;
create policy "promo_campaigns_master_write" on public.promo_campaigns for all using (public.current_role() = 'master_admin') with check (public.current_role() = 'master_admin');

drop policy if exists "applications_self_or_staff" on public.applications;
create policy "applications_self_or_staff" on public.applications for select using (public.can_access_application(id));
drop policy if exists "applications_user_insert" on public.applications;
create policy "applications_user_insert" on public.applications for insert with check (auth.uid() = user_id or public.current_role() = 'master_admin');
drop policy if exists "applications_user_or_staff_update" on public.applications;
create policy "applications_user_or_staff_update" on public.applications for update using (public.can_access_application(id)) with check (public.can_access_application(id));

drop policy if exists "application_marks_self_or_staff" on public.application_marks;
create policy "application_marks_self_or_staff" on public.application_marks for all using (
  public.can_access_application(application_id)
) with check (
  public.can_access_application(application_id)
);

drop policy if exists "application_institutions_self_or_staff" on public.application_institutions;
create policy "application_institutions_self_or_staff" on public.application_institutions for all using (
  public.can_access_application(application_id)
) with check (
  public.can_access_application(application_id)
);

drop policy if exists "carts_self_or_staff" on public.carts;
create policy "carts_self_or_staff" on public.carts for all using (auth.uid() = user_id or public.is_staff()) with check (auth.uid() = user_id or public.is_staff());

drop policy if exists "cart_items_self_or_staff" on public.cart_items;
create policy "cart_items_self_or_staff" on public.cart_items for all using (
  exists (
    select 1 from public.carts c
    where c.id = cart_id and (c.user_id = auth.uid() or public.is_staff())
  )
) with check (
  exists (
    select 1 from public.carts c
    where c.id = cart_id and (c.user_id = auth.uid() or public.is_staff())
  )
);

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

drop policy if exists "documents_self_or_staff" on public.documents;
create policy "documents_self_or_staff" on public.documents for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));

drop policy if exists "document_reviews_staff_only" on public.document_reviews;
create policy "document_reviews_staff_only" on public.document_reviews for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "notifications_self_or_staff" on public.notifications;
create policy "notifications_self_or_staff" on public.notifications for select using (user_id = auth.uid() or user_id is null or public.is_staff());
drop policy if exists "notifications_staff_insert" on public.notifications;
create policy "notifications_staff_insert" on public.notifications for insert with check (public.is_staff());
drop policy if exists "notifications_self_update_read" on public.notifications;
create policy "notifications_self_update_read" on public.notifications for update using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());

drop policy if exists "support_threads_self_or_staff" on public.support_threads;
create policy "support_threads_self_or_staff" on public.support_threads for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));

drop policy if exists "support_messages_thread_members" on public.support_messages;
create policy "support_messages_thread_members" on public.support_messages for all using (
  exists (
    select 1 from public.support_threads t
    where t.id = thread_id and public.can_access_user(t.user_id)
  )
) with check (
  exists (
    select 1 from public.support_threads t
    where t.id = thread_id and public.can_access_user(t.user_id)
  )
);

drop policy if exists "callback_requests_self_or_staff" on public.callback_requests;
create policy "callback_requests_self_or_staff" on public.callback_requests for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));

drop policy if exists "application_notes_self_or_staff" on public.application_notes;
create policy "application_notes_self_or_staff" on public.application_notes for all using (
  public.can_access_application(application_id)
) with check (
  public.can_access_application(application_id)
);

drop policy if exists "assistant_activity_staff_only" on public.assistant_activity;
create policy "assistant_activity_staff_only" on public.assistant_activity for all using (
  public.is_master_admin() or assistant_id = auth.uid()
) with check (public.is_staff());

drop policy if exists "assignments_staff_access" on public.assignments;
create policy "assignments_staff_access" on public.assignments for select using (
  public.current_role() = 'master_admin'
  or assistant_admin_id = auth.uid()
);

drop policy if exists "assignments_master_write" on public.assignments;
create policy "assignments_master_write" on public.assignments for all using (
  public.current_role() = 'master_admin'
) with check (
  public.current_role() = 'master_admin'
);

drop policy if exists "activity_logs_staff_access" on public.activity_logs;
create policy "activity_logs_staff_access" on public.activity_logs for select using (
  public.current_role() = 'master_admin'
  or admin_id = auth.uid()
);

drop policy if exists "activity_logs_staff_insert" on public.activity_logs;
create policy "activity_logs_staff_insert" on public.activity_logs for insert with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('kagie-documents', 'kagie-documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_bucket_authenticated_upload" on storage.objects;
create policy "documents_bucket_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'kagie-documents');

drop policy if exists "documents_bucket_owner_read" on storage.objects;
create policy "documents_bucket_owner_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'kagie-documents');

drop policy if exists "documents_bucket_owner_update" on storage.objects;
create policy "documents_bucket_owner_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'kagie-documents')
with check (bucket_id = 'kagie-documents');
