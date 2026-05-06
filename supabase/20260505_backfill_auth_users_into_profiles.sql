-- Backfill Supabase Auth accounts into public.profiles so the admin UI can list
-- older accounts that were created before the profile trigger was working.
--
-- Run once in the Supabase SQL editor as a database owner/service role.

insert into public.profiles (
  id,
  user_id,
  full_name,
  email,
  phone,
  role,
  is_active,
  created_at,
  updated_at
)
select
  au.id,
  au.id,
  coalesce(
    nullif(au.raw_user_meta_data ->> 'full_name', ''),
    nullif(au.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(au.email, ''), '@', 1),
    ''
  ) as full_name,
  coalesce(au.email, '') as email,
  coalesce(nullif(au.raw_user_meta_data ->> 'phone', ''), '') as phone,
  case
    when lower(coalesce(au.raw_app_meta_data ->> 'role', au.raw_user_meta_data ->> 'role', 'user')) in
      ('master_admin', 'master admin', 'master-admin', 'masteradmin', 'super_admin', 'super-admin', 'super admin', 'superadmin', 'owner')
      then 'master_admin'
    when lower(coalesce(au.raw_app_meta_data ->> 'role', au.raw_user_meta_data ->> 'role', 'user')) in
      ('assistant_admin', 'assistant', 'assistant admin', 'assistant-admin', 'assistantadmin', 'admin', 'administrator', 'staff', 'support', 'support_staff', 'support-staff', 'support staff')
      then 'assistant_admin'
    else 'user'
  end as role,
  au.banned_until is null as is_active,
  coalesce(au.created_at, timezone('utc', now())) as created_at,
  timezone('utc', now()) as updated_at
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;

update public.profiles
set user_id = id
where user_id is null;
