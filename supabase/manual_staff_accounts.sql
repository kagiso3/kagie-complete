-- Kagie manual staff creation / repair script
-- Paste this file into the Supabase SQL Editor and run it.
--
-- What it does:
-- 1. Creates or repairs a real auth user in auth.users
-- 2. Confirms the email automatically
-- 3. Creates or updates the Kagie profile role
-- 4. Ensures the Kagie profile scaffold exists
--
-- Use it for:
-- - first master admin
-- - assistant accounts
-- - fixing a broken staff login

create extension if not exists "pgcrypto";

create or replace function public.kagie_upsert_auth_staff(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text default '',
  p_role text default 'assistant_admin'
)
returns table (
  user_id uuid,
  email text,
  role text,
  was_created boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_password text := coalesce(p_password, '');
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_role text := lower(trim(coalesce(p_role, 'assistant_admin')));
  v_user_id uuid;
  v_created boolean := false;
begin
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Use a real email address.';
  end if;

  if length(v_password) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  if v_full_name = '' then
    raise exception 'Full name is required.';
  end if;

  if v_role not in ('user', 'assistant_admin', 'master_admin') then
    raise exception 'Role must be user, assistant_admin, or master_admin.';
  end if;

  select u.id
    into v_user_id
  from auth.users u
  where lower(coalesce(u.email, '')) = v_email
  limit 1;

  if v_user_id is null then
    v_user_id := extensions.gen_random_uuid();
    v_created := true;

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_sent_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf'::text)),
      timezone('utc', now()),
      timezone('utc', now()),
      jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', v_role
      ),
      jsonb_build_object(
        'full_name', v_full_name,
        'phone', v_phone,
        'role', v_role
      ),
      timezone('utc', now()),
      timezone('utc', now())
    );
  else
    update auth.users
    set
      email = v_email,
      encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf'::text)),
      email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', v_role
      ),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'full_name', v_full_name,
        'phone', v_phone,
        'role', v_role
      ),
      updated_at = timezone('utc', now())
    where id = v_user_id;
  end if;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    extensions.gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email
    ),
    'email',
    v_user_id::text,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (provider, provider_id) do update
  set
    identity_data = excluded.identity_data,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = excluded.updated_at;

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    role,
    is_active,
    updated_at
  )
  values (
    v_user_id,
    v_full_name,
    v_email,
    v_phone,
    v_role,
    true,
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    is_active = true,
    updated_at = timezone('utc', now());

  insert into public.user_profiles (user_id) values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.guardian_profiles (user_id) values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.school_profiles (user_id) values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.carts (user_id) values (v_user_id)
  on conflict (user_id) do nothing;

  if v_role = 'user' then
    if not exists (
      select 1
      from public.applications
      where user_id = v_user_id
        and status = 'Draft'
    ) then
      insert into public.applications (user_id)
      values (v_user_id);
    end if;
  end if;

  return query
  select v_user_id, v_email, v_role, v_created;
end;
$$;

comment on function public.kagie_upsert_auth_staff(text, text, text, text, text)
is 'Creates or repairs a Kagie auth user plus profile scaffold for master_admin, assistant_admin, or user.';

-- -------------------------------------------------------------------
-- Example 1: create or repair the live master admin
-- -------------------------------------------------------------------
select *
from public.kagie_upsert_auth_staff(
  'masteradmin@kagie.app',
  'Kagiso@05',
  'Kagiso Witness',
  '',
  'master_admin'
);

-- -------------------------------------------------------------------
-- Example 2: create or repair an assistant
-- Replace the email, password, and name before running.
-- -------------------------------------------------------------------
-- select *
-- from public.kagie_upsert_auth_staff(
--   'assistant1@kagie.app',
--   'Assistant@05',
--   'Assistant One',
--   '0712345678',
--   'assistant_admin'
-- );

-- -------------------------------------------------------------------
-- Check current staff accounts
-- -------------------------------------------------------------------
-- select id, full_name, email, role, is_active, created_at
-- from public.profiles
-- where role in ('master_admin', 'assistant_admin')
-- order by created_at asc;
