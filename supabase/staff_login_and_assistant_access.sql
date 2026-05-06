-- Kagie staff login + assistant access repair
-- Run this once in the Supabase SQL Editor.
--
-- What it fixes:
-- 1. Stops recursive profile-role checks.
-- 2. Declares who is staff and who can manage assistants.
-- 3. Syncs auth metadata <-> profiles for master_admin / assistant_admin.
-- 4. Ensures staff scaffold rows exist so Kagie can log them in cleanly.
--
-- Important:
-- Kagie assistant creation is still performed by the secure serverless admin route.
-- This SQL makes sure the database agrees on:
--   master_admin = can create/manage assistants
--   assistant_admin = can log in as Kagie assistant staff

create extension if not exists "pgcrypto";

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    'user'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_role() in ('assistant_admin', 'master_admin');
$$;

create or replace function public.can_manage_assistants()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_role() = 'master_admin';
$$;

grant execute on function public.current_role() to anon, authenticated, service_role;
grant execute on function public.is_staff() to anon, authenticated, service_role;
grant execute on function public.can_manage_assistants() to anon, authenticated, service_role;

-- Keep the core policies aligned with the Kagie role helpers.
drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff"
on public.profiles
for select
using (auth.uid() = id or public.is_staff());

drop policy if exists "profiles_update_self_or_master" on public.profiles;
create policy "profiles_update_self_or_master"
on public.profiles
for update
using (auth.uid() = id or public.current_role() = 'master_admin')
with check (auth.uid() = id or public.current_role() = 'master_admin');

-- If a staff user already exists in profiles, push that role into auth metadata too.
update auth.users u
set
  raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'providers', coalesce(u.raw_app_meta_data -> 'providers', jsonb_build_array('email')),
    'role', p.role
  ),
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'full_name', coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name', ''),
    'phone', coalesce(nullif(p.phone, ''), u.raw_user_meta_data ->> 'phone', ''),
    'role', p.role
  ),
  email_confirmed_at = coalesce(u.email_confirmed_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
from public.profiles p
where u.id = p.id
  and p.role in ('assistant_admin', 'master_admin');

-- If a staff user already exists in auth metadata, make sure profiles matches it.
update public.profiles p
set
  full_name = coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name', p.full_name),
  email = coalesce(nullif(lower(u.email), ''), p.email),
  phone = coalesce(nullif(u.raw_user_meta_data ->> 'phone', ''), p.phone),
  role = lower(coalesce(
    nullif(u.raw_app_meta_data ->> 'role', ''),
    nullif(u.raw_user_meta_data ->> 'role', ''),
    p.role
  )),
  is_active = true,
  updated_at = timezone('utc', now())
from auth.users u
where p.id = u.id
  and lower(coalesce(
    nullif(u.raw_app_meta_data ->> 'role', ''),
    nullif(u.raw_user_meta_data ->> 'role', ''),
    p.role
  )) in ('assistant_admin', 'master_admin');

-- Create missing staff profiles from auth.users if they are missing completely.
insert into public.profiles (
  id,
  full_name,
  email,
  phone,
  role,
  is_active,
  created_at,
  updated_at
)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(u.email, ''), '@', 1)),
  lower(coalesce(u.email, '')),
  coalesce(u.raw_user_meta_data ->> 'phone', ''),
  lower(coalesce(
    nullif(u.raw_app_meta_data ->> 'role', ''),
    nullif(u.raw_user_meta_data ->> 'role', '')
  )),
  true,
  coalesce(u.created_at, timezone('utc', now())),
  timezone('utc', now())
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
  and lower(coalesce(
    nullif(u.raw_app_meta_data ->> 'role', ''),
    nullif(u.raw_user_meta_data ->> 'role', '')
  )) in ('assistant_admin', 'master_admin');

-- Staff accounts still use the normal Kagie side tables.
insert into public.user_profiles (user_id)
select p.id
from public.profiles p
left join public.user_profiles up on up.user_id = p.id
where up.user_id is null
  and p.role in ('assistant_admin', 'master_admin');

insert into public.guardian_profiles (user_id)
select p.id
from public.profiles p
left join public.guardian_profiles gp on gp.user_id = p.id
where gp.user_id is null
  and p.role in ('assistant_admin', 'master_admin');

insert into public.school_profiles (user_id)
select p.id
from public.profiles p
left join public.school_profiles sp on sp.user_id = p.id
where sp.user_id is null
  and p.role in ('assistant_admin', 'master_admin');

insert into public.carts (user_id)
select p.id
from public.profiles p
left join public.carts c on c.user_id = p.id
where c.user_id is null
  and p.role in ('assistant_admin', 'master_admin');

-- Helpful checks after running:
-- 1. These are the staff accounts Kagie will recognize.
-- select id, full_name, email, role, is_active
-- from public.profiles
-- where role in ('master_admin', 'assistant_admin')
-- order by role desc, created_at asc;
--
-- 2. Master admins who can manage assistants.
-- select id, email, role
-- from public.profiles
-- where role = 'master_admin';
--
-- 3. If you want to create or repair one exact staff account, use:
-- select *
-- from public.kagie_upsert_auth_staff(
--   'assistant1@kagie.app',
--   'Assistant@05',
--   'Assistant One',
--   '0712345678',
--   'assistant_admin'
-- );
