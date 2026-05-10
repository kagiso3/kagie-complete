-- Keeps learner form details visible to staff dashboards and fast to query.
-- Run this after the base Kagie schema if the deployed Supabase project has
-- older duplicate detail rows or is missing the latest admin performance indexes.

with ranked as (
  select ctid, row_number() over (
    partition by user_id
    order by coalesce(updated_at, created_at) desc nulls last, ctid desc
  ) as row_num
  from public.user_profiles
  where user_id is not null
)
delete from public.user_profiles
where ctid in (select ctid from ranked where row_num > 1);

with ranked as (
  select ctid, row_number() over (
    partition by user_id
    order by coalesce(updated_at, created_at) desc nulls last, ctid desc
  ) as row_num
  from public.guardian_profiles
  where user_id is not null
)
delete from public.guardian_profiles
where ctid in (select ctid from ranked where row_num > 1);

with ranked as (
  select ctid, row_number() over (
    partition by user_id
    order by coalesce(updated_at, created_at) desc nulls last, ctid desc
  ) as row_num
  from public.school_profiles
  where user_id is not null
)
delete from public.school_profiles
where ctid in (select ctid from ranked where row_num > 1);

create unique index if not exists user_profiles_user_id_unique_idx
on public.user_profiles (user_id);

create unique index if not exists guardian_profiles_user_id_unique_idx
on public.guardian_profiles (user_id);

create unique index if not exists school_profiles_user_id_unique_idx
on public.school_profiles (user_id);

create index if not exists idx_profiles_role_created_at
on public.profiles (role, created_at desc);

create index if not exists idx_profiles_email_lower
on public.profiles (lower(email));

create index if not exists idx_applications_user_updated
on public.applications (user_id, updated_at desc);

create index if not exists idx_applications_status_updated
on public.applications (status, updated_at desc);

create index if not exists idx_application_institutions_application_id
on public.application_institutions (application_id);

create index if not exists idx_application_marks_application_id
on public.application_marks (application_id);

create index if not exists idx_documents_user_application
on public.documents (user_id, application_id);

alter table public.user_profiles enable row level security;
alter table public.guardian_profiles enable row level security;
alter table public.school_profiles enable row level security;

drop policy if exists "user_profiles_self_or_staff" on public.user_profiles;
create policy "user_profiles_self_or_staff"
on public.user_profiles
for all
using (public.can_access_user(user_id))
with check (public.can_access_user(user_id));

drop policy if exists "guardian_profiles_self_or_staff" on public.guardian_profiles;
create policy "guardian_profiles_self_or_staff"
on public.guardian_profiles
for all
using (public.can_access_user(user_id))
with check (public.can_access_user(user_id));

drop policy if exists "school_profiles_self_or_staff" on public.school_profiles;
create policy "school_profiles_self_or_staff"
on public.school_profiles
for all
using (public.can_access_user(user_id))
with check (public.can_access_user(user_id));
