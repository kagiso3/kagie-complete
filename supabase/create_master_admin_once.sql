create extension if not exists "pgcrypto" with schema extensions;

do $$
declare
  v_email text := 'masteradmin@kagie.app';
  v_password text := 'Kagiso@05';
  v_full_name text := 'Kagiso Witness';
  v_phone text := '';
  v_user_id uuid;
begin
  select id
    into v_user_id
  from auth.users
  where lower(coalesce(email, '')) = lower(v_email)
  limit 1;

  if v_user_id is null then
    v_user_id := extensions.gen_random_uuid();

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
        'role', 'master_admin'
      ),
      jsonb_build_object(
        'full_name', v_full_name,
        'phone', v_phone,
        'role', 'master_admin'
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
        'role', 'master_admin'
      ),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'full_name', v_full_name,
        'phone', v_phone,
        'role', 'master_admin'
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
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
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
    'master_admin',
    true,
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    role = 'master_admin',
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
end $$;

select id, full_name, email, role, is_active
from public.profiles
where lower(email) = 'masteradmin@kagie.app';
