-- Safe production repair for Kagie profile saves, institution controls, and Career Hub question papers.
-- Run this in Supabase SQL editor, then reload the app.

alter table public.profiles add column if not exists user_id uuid;
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists id_number text not null default '';
alter table public.profiles add column if not exists province text not null default '';
alter table public.profiles add column if not exists city text not null default '';

update public.profiles
set user_id = id
where user_id is null;

create unique index if not exists profiles_user_id_unique_idx on public.profiles(user_id);

insert into public.profiles (id, user_id, email, full_name, role)
select
  u.id,
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
  case
    when coalesce(u.raw_user_meta_data->>'role', '') in ('master_admin', 'assistant_admin', 'user')
      then u.raw_user_meta_data->>'role'
    else 'user'
  end
from auth.users u
on conflict (id) do update
set
  user_id = coalesce(public.profiles.user_id, excluded.user_id),
  email = coalesce(nullif(public.profiles.email, ''), excluded.email),
  full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
  updated_at = timezone('utc', now());

alter table public.institutions add column if not exists website text not null default '';
alter table public.institutions add column if not exists notes text not null default '';

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

create index if not exists idx_question_papers_lookup
  on public.question_papers(grade, subject, year, term, status);
create index if not exists idx_question_papers_status
  on public.question_papers(status);

drop trigger if exists set_question_papers_updated_at on public.question_papers;
create trigger set_question_papers_updated_at
before update on public.question_papers
for each row execute procedure public.set_updated_at();

alter table public.question_papers enable row level security;

drop policy if exists "profiles_insert_self_or_master" on public.profiles;
create policy "profiles_insert_self_or_master"
on public.profiles
for insert
with check (auth.uid() = id or public.current_role() = 'master_admin');

drop policy if exists "profiles_update_self_or_master" on public.profiles;
create policy "profiles_update_self_or_master"
on public.profiles
for update
using (auth.uid() = id or public.current_role() = 'master_admin')
with check (auth.uid() = id or public.current_role() = 'master_admin');

drop policy if exists "question_papers_published_read" on public.question_papers;
create policy "question_papers_published_read"
on public.question_papers
for select
using (status = 'Published' or public.current_role() in ('assistant_admin', 'master_admin'));

drop policy if exists "question_papers_master_write" on public.question_papers;
create policy "question_papers_master_write"
on public.question_papers
for all
using (public.current_role() = 'master_admin')
with check (public.current_role() = 'master_admin');

notify pgrst, 'reload schema';
