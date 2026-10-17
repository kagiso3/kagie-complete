-- Master Admin management center records and learner visibility rules.
-- Run after the base Kagie schema and the admin content controls migration.

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

alter table public.announcements drop constraint if exists announcements_priority_check;
alter table public.announcements add constraint announcements_priority_check
  check (priority in ('normal', 'important', 'urgent'));

create index if not exists idx_career_articles_status_updated
  on public.career_articles(status, updated_at desc);
create index if not exists idx_housing_listings_visibility_updated
  on public.housing_listings(is_active, listing_state, updated_at desc);
create index if not exists idx_housing_listings_location
  on public.housing_listings(province, city);
create index if not exists idx_housing_listings_institution_id
  on public.housing_listings(institution_id);
create index if not exists idx_application_institutions_institution_id
  on public.application_institutions(institution_id);
create index if not exists idx_institutions_visibility_status
  on public.institutions(is_active, manual_status, closing_date);
create index if not exists idx_institutions_location
  on public.institutions(province, city);
create index if not exists idx_announcements_schedule
  on public.announcements(status, scheduled_for);

drop trigger if exists set_career_articles_updated_at on public.career_articles;
create trigger set_career_articles_updated_at
before update on public.career_articles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_housing_listings_updated_at on public.housing_listings;
create trigger set_housing_listings_updated_at
before update on public.housing_listings
for each row execute procedure public.set_updated_at();

alter table public.career_articles enable row level security;
alter table public.housing_listings enable row level security;

drop policy if exists "career_articles_published_or_staff_read" on public.career_articles;
create policy "career_articles_published_or_staff_read"
on public.career_articles
for select
using (status = 'published' or public.is_staff());

drop policy if exists "career_articles_master_write" on public.career_articles;
create policy "career_articles_master_write"
on public.career_articles
for all
using (public.current_role() = 'master_admin')
with check (public.current_role() = 'master_admin');

drop policy if exists "housing_listings_public_or_staff_read" on public.housing_listings;
create policy "housing_listings_public_or_staff_read"
on public.housing_listings
for select
using ((listing_state = 'published' and is_active = true) or public.is_staff());

drop policy if exists "housing_listings_master_write" on public.housing_listings;
create policy "housing_listings_master_write"
on public.housing_listings
for all
using (public.current_role() = 'master_admin')
with check (public.current_role() = 'master_admin');

drop policy if exists "institutions_public_read" on public.institutions;
create policy "institutions_public_read"
on public.institutions
for select
using (
  public.is_staff()
  or (
    is_active = true
    and coalesce(nullif(manual_status, ''), 'open') <> 'closed'
    and (opening_date is null or opening_date <= current_date)
    and (closing_date is null or closing_date >= current_date)
  )
);
