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

create index if not exists idx_assignments_user_id on public.assignments(user_id);
create index if not exists idx_assignments_assistant_admin_id on public.assignments(assistant_admin_id);
create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
create index if not exists idx_activity_logs_admin_id on public.activity_logs(admin_id);
create index if not exists idx_activity_logs_timestamp on public.activity_logs(timestamp desc);

drop trigger if exists set_assignments_updated_at on public.assignments;
create trigger set_assignments_updated_at before update on public.assignments for each row execute procedure public.set_updated_at();
drop trigger if exists set_activity_logs_updated_at on public.activity_logs;
create trigger set_activity_logs_updated_at before update on public.activity_logs for each row execute procedure public.set_updated_at();

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

alter table public.assignments enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff" on public.profiles for select using (
  auth.uid() = id or public.is_master_admin() or public.can_access_user(id)
);

drop policy if exists "user_profiles_self_or_staff" on public.user_profiles;
create policy "user_profiles_self_or_staff" on public.user_profiles for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));
drop policy if exists "guardian_profiles_self_or_staff" on public.guardian_profiles;
create policy "guardian_profiles_self_or_staff" on public.guardian_profiles for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));
drop policy if exists "school_profiles_self_or_staff" on public.school_profiles;
create policy "school_profiles_self_or_staff" on public.school_profiles for all using (public.can_access_user(user_id)) with check (public.can_access_user(user_id));

drop policy if exists "applications_self_or_staff" on public.applications;
create policy "applications_self_or_staff" on public.applications for select using (public.can_access_application(id));
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
  public.is_master_admin() or assistant_admin_id = auth.uid()
);

drop policy if exists "assignments_master_write" on public.assignments;
create policy "assignments_master_write" on public.assignments for all using (
  public.is_master_admin()
) with check (
  public.is_master_admin()
);

drop policy if exists "activity_logs_staff_access" on public.activity_logs;
create policy "activity_logs_staff_access" on public.activity_logs for select using (
  public.is_master_admin() or admin_id = auth.uid()
);

drop policy if exists "activity_logs_staff_insert" on public.activity_logs;
create policy "activity_logs_staff_insert" on public.activity_logs for insert with check (public.is_staff());
