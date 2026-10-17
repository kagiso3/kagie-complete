-- Kagie admin permissions, applicant updates, and full support tickets.
-- Run after the base schema and previous admin/assignment migrations.

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

create table if not exists public.application_form_types (
  form_type text primary key,
  label text not null,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.application_form_types (form_type, label, display_order, is_active)
values
  ('undergraduate', 'Undergraduate Applications', 10, true),
  ('bridging', 'Bridging Programmes', 20, true),
  ('transfer', 'Transfer Applications', 30, true),
  ('postgraduate', 'Postgraduate Applications', 40, true),
  ('late', 'Late Applications', 50, true)
on conflict (form_type) do update
set
  label = excluded.label,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

create table if not exists public.assistant_form_permissions (
  assistant_admin_id uuid not null references public.profiles(id) on delete cascade,
  form_type text not null references public.application_form_types(form_type) on delete cascade,
  enabled boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (assistant_admin_id, form_type)
);

insert into public.assistant_form_permissions (assistant_admin_id, form_type, enabled, granted_by)
select p.id, aft.form_type, true, null
from public.profiles p
cross join public.application_form_types aft
where p.role = 'assistant_admin'
on conflict (assistant_admin_id, form_type) do nothing;

create or replace function public.assistant_has_form_access(assistant_id uuid, form_type_arg text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_role() = 'master_admin'
    or coalesce((
      select afp.enabled
      from public.assistant_form_permissions afp
      where afp.assistant_admin_id = assistant_id
        and afp.form_type = public.normalize_application_type(form_type_arg)
      limit 1
    ), not exists (
      select 1
      from public.assistant_form_permissions existing
      where existing.assistant_admin_id = assistant_id
    ));
$$;

create or replace function public.can_access_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    where a.id = target_application_id
      and (
        a.user_id = auth.uid()
        or public.is_master_admin()
        or (
          a.assistant_id = auth.uid()
          and public.assistant_has_form_access(auth.uid(), a.application_type)
        )
        or exists (
          select 1
          from public.assignments ass
          where ass.user_id = a.user_id
            and ass.assistant_admin_id = auth.uid()
            and public.assistant_has_form_access(auth.uid(), a.application_type)
        )
      )
  );
$$;

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

alter table public.support_threads add column if not exists subject text not null default 'Support request';
alter table public.support_threads add column if not exists category text not null default 'General';
alter table public.support_threads add column if not exists priority text not null default 'normal';
alter table public.support_threads add column if not exists last_message_at timestamptz;
alter table public.support_threads add column if not exists closed_at timestamptz;

alter table public.support_threads drop constraint if exists support_threads_status_check;
alter table public.support_threads add constraint support_threads_status_check
check (status in ('open', 'in_progress', 'awaiting_user', 'resolved', 'closed'));

alter table public.support_messages add column if not exists attachment_url text not null default '';
alter table public.support_messages add column if not exists is_internal boolean not null default false;

create index if not exists idx_assistant_form_permissions_assistant
  on public.assistant_form_permissions(assistant_admin_id, enabled);
create index if not exists idx_application_updates_user_created
  on public.application_updates(user_id, created_at desc);
create index if not exists idx_application_updates_application_created
  on public.application_updates(application_id, created_at desc);
create index if not exists idx_support_threads_status_updated
  on public.support_threads(status, updated_at desc);

drop trigger if exists set_application_form_types_updated_at on public.application_form_types;
create trigger set_application_form_types_updated_at
before update on public.application_form_types
for each row execute procedure public.set_updated_at();

drop trigger if exists set_assistant_form_permissions_updated_at on public.assistant_form_permissions;
create trigger set_assistant_form_permissions_updated_at
before update on public.assistant_form_permissions
for each row execute procedure public.set_updated_at();

drop trigger if exists set_application_updates_updated_at on public.application_updates;
create trigger set_application_updates_updated_at
before update on public.application_updates
for each row execute procedure public.set_updated_at();

alter table public.application_form_types enable row level security;
alter table public.assistant_form_permissions enable row level security;
alter table public.application_updates enable row level security;

drop policy if exists "application_form_types_staff_read" on public.application_form_types;
create policy "application_form_types_staff_read"
on public.application_form_types
for select
using (public.is_staff());

drop policy if exists "application_form_types_master_write" on public.application_form_types;
create policy "application_form_types_master_write"
on public.application_form_types
for all
using (public.current_role() = 'master_admin')
with check (public.current_role() = 'master_admin');

drop policy if exists "assistant_form_permissions_staff_read" on public.assistant_form_permissions;
create policy "assistant_form_permissions_staff_read"
on public.assistant_form_permissions
for select
using (
  public.current_role() = 'master_admin'
  or assistant_admin_id = auth.uid()
);

drop policy if exists "assistant_form_permissions_master_write" on public.assistant_form_permissions;
create policy "assistant_form_permissions_master_write"
on public.assistant_form_permissions
for all
using (public.current_role() = 'master_admin')
with check (public.current_role() = 'master_admin');

drop policy if exists "application_updates_user_or_authorized_staff_read" on public.application_updates;
create policy "application_updates_user_or_authorized_staff_read"
on public.application_updates
for select
using (
  user_id = auth.uid()
  or public.current_role() = 'master_admin'
  or (
    application_id is not null
    and public.can_access_application(application_id)
  )
);

drop policy if exists "application_updates_authorized_staff_insert" on public.application_updates;
create policy "application_updates_authorized_staff_insert"
on public.application_updates
for insert
with check (
  public.current_role() = 'master_admin'
  or (
    public.current_role() = 'assistant_admin'
    and application_id is not null
    and public.can_access_application(application_id)
  )
);

drop policy if exists "application_updates_user_mark_read_or_staff_update" on public.application_updates;
create policy "application_updates_user_mark_read_or_staff_update"
on public.application_updates
for update
using (
  user_id = auth.uid()
  or public.current_role() = 'master_admin'
  or (
    application_id is not null
    and public.can_access_application(application_id)
  )
)
with check (
  user_id = auth.uid()
  or public.current_role() = 'master_admin'
  or (
    application_id is not null
    and public.can_access_application(application_id)
  )
);

drop policy if exists "support_threads_self_or_staff" on public.support_threads;
create policy "support_threads_self_or_staff"
on public.support_threads
for all
using (public.can_access_user(user_id))
with check (public.can_access_user(user_id));

drop policy if exists "support_messages_thread_members" on public.support_messages;
create policy "support_messages_thread_members"
on public.support_messages
for all
using (
  exists (
    select 1
    from public.support_threads t
    where t.id = thread_id
      and public.can_access_user(t.user_id)
  )
)
with check (
  exists (
    select 1
    from public.support_threads t
    where t.id = thread_id
      and public.can_access_user(t.user_id)
  )
);
