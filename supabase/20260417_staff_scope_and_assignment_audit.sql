create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'master_admin';
$$;

create or replace function public.is_assigned_assistant_for_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications a
    where a.user_id = target_user_id
      and a.assistant_id = auth.uid()
  )
  or exists (
    select 1
    from public.callback_requests c
    where c.user_id = target_user_id
      and c.assigned_assistant_id = auth.uid()
  )
  or exists (
    select 1
    from public.support_threads t
    where t.user_id = target_user_id
      and t.assistant_id = auth.uid()
  );
$$;

create or replace function public.can_staff_access_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_master_admin()
    or (public.current_role() = 'assistant_admin' and public.is_assigned_assistant_for_user(target_user_id));
$$;

create or replace function public.can_staff_access_application(target_application_id uuid)
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
        or (public.current_role() = 'assistant_admin' and a.assistant_id = auth.uid())
      )
  );
$$;

alter table public.applications add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.applications add column if not exists assigned_at timestamptz;
alter table public.applications add column if not exists assignment_status text not null default 'Unassigned';

update public.applications
set assignment_status = case
  when assistant_id is not null then 'Assigned'
  else 'Unassigned'
end
where coalesce(nullif(assignment_status, ''), 'Unassigned') not in ('Assigned', 'Reassigned', 'Unassigned');

alter table public.applications drop constraint if exists applications_assignment_status_check;
alter table public.applications add constraint applications_assignment_status_check check (
  assignment_status in ('Assigned', 'Reassigned', 'Unassigned')
);

drop policy if exists "profiles_select_self_or_staff" on public.profiles;
create policy "profiles_select_self_or_staff" on public.profiles
for select
using (auth.uid() = id or public.can_staff_access_user(id));

drop policy if exists "user_profiles_self_or_staff" on public.user_profiles;
create policy "user_profiles_self_or_staff" on public.user_profiles
for all
using (auth.uid() = user_id or public.can_staff_access_user(user_id))
with check (auth.uid() = user_id or public.can_staff_access_user(user_id));

drop policy if exists "guardian_profiles_self_or_staff" on public.guardian_profiles;
create policy "guardian_profiles_self_or_staff" on public.guardian_profiles
for all
using (auth.uid() = user_id or public.can_staff_access_user(user_id))
with check (auth.uid() = user_id or public.can_staff_access_user(user_id));

drop policy if exists "school_profiles_self_or_staff" on public.school_profiles;
create policy "school_profiles_self_or_staff" on public.school_profiles
for all
using (auth.uid() = user_id or public.can_staff_access_user(user_id))
with check (auth.uid() = user_id or public.can_staff_access_user(user_id));

drop policy if exists "applications_self_or_staff" on public.applications;
create policy "applications_self_or_staff" on public.applications
for select
using (
  auth.uid() = user_id
  or public.is_master_admin()
  or (public.current_role() = 'assistant_admin' and assistant_id = auth.uid())
);

drop policy if exists "applications_user_or_staff_update" on public.applications;
create policy "applications_user_or_staff_update" on public.applications
for update
using (
  auth.uid() = user_id
  or public.is_master_admin()
  or (public.current_role() = 'assistant_admin' and assistant_id = auth.uid())
)
with check (
  auth.uid() = user_id
  or public.is_master_admin()
  or (public.current_role() = 'assistant_admin' and assistant_id = auth.uid())
);

drop policy if exists "application_marks_self_or_staff" on public.application_marks;
create policy "application_marks_self_or_staff" on public.application_marks
for all
using (public.can_staff_access_application(application_id))
with check (public.can_staff_access_application(application_id));

drop policy if exists "application_institutions_self_or_staff" on public.application_institutions;
create policy "application_institutions_self_or_staff" on public.application_institutions
for all
using (public.can_staff_access_application(application_id))
with check (public.can_staff_access_application(application_id));

drop policy if exists "carts_self_or_staff" on public.carts;
create policy "carts_self_or_staff" on public.carts
for all
using (auth.uid() = user_id or public.can_staff_access_user(user_id))
with check (auth.uid() = user_id or public.can_staff_access_user(user_id));

drop policy if exists "cart_items_self_or_staff" on public.cart_items;
create policy "cart_items_self_or_staff" on public.cart_items
for all
using (
  exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and (auth.uid() = c.user_id or public.can_staff_access_user(c.user_id))
  )
)
with check (
  exists (
    select 1
    from public.carts c
    where c.id = cart_id
      and (auth.uid() = c.user_id or public.can_staff_access_user(c.user_id))
  )
);

drop policy if exists "payments_self_or_staff" on public.payments;
create policy "payments_self_or_staff" on public.payments
for select
using (public.can_staff_access_application(application_id));

drop policy if exists "payments_user_insert_or_staff" on public.payments;
create policy "payments_user_insert_or_staff" on public.payments
for insert
with check (public.can_staff_access_application(application_id));

drop policy if exists "payments_staff_update" on public.payments;
create policy "payments_staff_update" on public.payments
for update
using (
  public.is_master_admin()
  or exists (
    select 1
    from public.applications a
    where a.id = application_id
      and a.assistant_id = auth.uid()
  )
)
with check (
  public.is_master_admin()
  or exists (
    select 1
    from public.applications a
    where a.id = application_id
      and a.assistant_id = auth.uid()
  )
);

drop policy if exists "documents_self_or_staff" on public.documents;
create policy "documents_self_or_staff" on public.documents
for all
using (auth.uid() = user_id or public.can_staff_access_user(user_id))
with check (auth.uid() = user_id or public.can_staff_access_user(user_id));

drop policy if exists "document_reviews_staff_only" on public.document_reviews;
create policy "document_reviews_staff_only" on public.document_reviews
for all
using (
  public.is_master_admin()
  or exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.user_id in (
        select p.id from public.profiles p where public.can_staff_access_user(p.id)
      )
  )
)
with check (
  public.is_master_admin()
  or exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.user_id in (
        select p.id from public.profiles p where public.can_staff_access_user(p.id)
      )
  )
);

drop policy if exists "notifications_self_or_staff" on public.notifications;
create policy "notifications_self_or_staff" on public.notifications
for select
using (
  user_id = auth.uid()
  or user_id is null
  or public.is_master_admin()
);

drop policy if exists "notifications_self_update_read" on public.notifications;
create policy "notifications_self_update_read" on public.notifications
for update
using (
  user_id = auth.uid()
  or user_id is null
  or public.is_master_admin()
)
with check (
  user_id = auth.uid()
  or user_id is null
  or public.is_master_admin()
);

drop policy if exists "support_threads_self_or_staff" on public.support_threads;
create policy "support_threads_self_or_staff" on public.support_threads
for all
using (
  auth.uid() = user_id
  or public.is_master_admin()
  or assistant_id = auth.uid()
)
with check (
  auth.uid() = user_id
  or public.is_master_admin()
  or assistant_id = auth.uid()
);

drop policy if exists "support_messages_thread_members" on public.support_messages;
create policy "support_messages_thread_members" on public.support_messages
for all
using (
  exists (
    select 1
    from public.support_threads t
    where t.id = thread_id
      and (
        t.user_id = auth.uid()
        or t.assistant_id = auth.uid()
        or public.is_master_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.support_threads t
    where t.id = thread_id
      and (
        t.user_id = auth.uid()
        or t.assistant_id = auth.uid()
        or public.is_master_admin()
      )
  )
);

drop policy if exists "callback_requests_self_or_staff" on public.callback_requests;
create policy "callback_requests_self_or_staff" on public.callback_requests
for all
using (
  auth.uid() = user_id
  or public.is_master_admin()
  or assigned_assistant_id = auth.uid()
)
with check (
  auth.uid() = user_id
  or public.is_master_admin()
  or assigned_assistant_id = auth.uid()
);

drop policy if exists "application_notes_self_or_staff" on public.application_notes;
create policy "application_notes_self_or_staff" on public.application_notes
for all
using (public.can_staff_access_application(application_id))
with check (public.can_staff_access_application(application_id));

drop policy if exists "assistant_activity_staff_only" on public.assistant_activity;
create policy "assistant_activity_staff_only" on public.assistant_activity
for all
using (public.is_master_admin() or assistant_id = auth.uid())
with check (public.is_master_admin() or assistant_id = auth.uid());
