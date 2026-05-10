-- Master Admin content controls for Career Hub, Housing, and Announcements.
-- Run once in the Supabase SQL editor before relying on cross-device admin content.

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

create index if not exists idx_admin_content_key_status
  on public.admin_content(content_key, status);

create index if not exists idx_announcements_audience_status_created
  on public.announcements(audience, status, created_at desc);

drop trigger if exists set_admin_content_updated_at on public.admin_content;
create trigger set_admin_content_updated_at
before update on public.admin_content
for each row execute procedure public.set_updated_at();

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
before update on public.announcements
for each row execute procedure public.set_updated_at();

alter table public.admin_content enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "admin_content_active_read" on public.admin_content;
create policy "admin_content_active_read"
on public.admin_content
for select
using (status = 'active' or public.is_staff());

drop policy if exists "admin_content_master_write" on public.admin_content;
create policy "admin_content_master_write"
on public.admin_content
for all
using (public.current_role() = 'master_admin')
with check (public.current_role() = 'master_admin');

drop policy if exists "announcements_active_read" on public.announcements;
create policy "announcements_active_read"
on public.announcements
for select
using (status = 'active' or public.is_staff());

drop policy if exists "announcements_master_write" on public.announcements;
create policy "announcements_master_write"
on public.announcements
for all
using (public.current_role() = 'master_admin')
with check (public.current_role() = 'master_admin');
