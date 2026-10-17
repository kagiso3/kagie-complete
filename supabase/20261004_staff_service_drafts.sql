-- Apply after 20260521_master_admin_management_center.sql and
-- 20260815_career_hub_opportunities.sql. Existing Master Admin policies remain.
-- Assistants submit their own drafts. Master Admin can explicitly delegate
-- direct opportunity publication and institution controls.
begin;

create table if not exists public.assistant_service_permissions (
  assistant_admin_id uuid not null references public.profiles(id) on delete cascade,
  service_key text not null check (service_key in ('applications','support','updates','institutions','accommodation','cv','jobs','publish_jobs')),
  enabled boolean not null default false,
  granted_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (assistant_admin_id, service_key)
);
alter table public.assistant_service_permissions enable row level security;
drop policy if exists assistant_services_read on public.assistant_service_permissions;
create policy assistant_services_read on public.assistant_service_permissions for select to authenticated
using (public.current_role() = 'master_admin' or assistant_admin_id = auth.uid());
drop policy if exists assistant_services_master_write on public.assistant_service_permissions;
create policy assistant_services_master_write on public.assistant_service_permissions for all to authenticated
using (public.current_role() = 'master_admin') with check (public.current_role() = 'master_admin');
drop trigger if exists set_assistant_service_permissions_updated_at on public.assistant_service_permissions;
create trigger set_assistant_service_permissions_updated_at before update on public.assistant_service_permissions
for each row execute procedure public.set_updated_at();

create or replace function public.assistant_has_service_access(assistant_id_arg uuid, key_arg text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare enabled_value boolean;
begin
  if assistant_id_arg is distinct from auth.uid() and public.current_role() <> 'master_admin' then return false; end if;
  if public.current_role() = 'master_admin' then return true; end if;
  if public.current_role() <> 'assistant_admin' then return false; end if;
  select enabled into enabled_value from public.assistant_service_permissions
    where assistant_admin_id = assistant_id_arg and service_key = key_arg;
  -- Preserve existing assigned-work access; privileged delegation is opt-in.
  return coalesce(enabled_value, key_arg in ('applications','support','updates','accommodation','cv','jobs'));
end;
$$;
revoke all on function public.assistant_has_service_access(uuid,text) from public;
grant execute on function public.assistant_has_service_access(uuid,text) to authenticated;

insert into public.assistant_service_permissions (assistant_admin_id,service_key,enabled)
select p.id,k.service_key,k.service_key not in ('institutions','publish_jobs')
from public.profiles p cross join (values ('applications'),('support'),('updates'),('institutions'),('accommodation'),('cv'),('jobs'),('publish_jobs')) k(service_key)
where p.role = 'assistant_admin' on conflict do nothing;

-- Restrictive policies complement the existing assignment and form policies.
-- They cannot broaden an assistant's learner/application scope.
drop policy if exists applications_service_access on public.applications;
create policy applications_service_access on public.applications as restrictive for all to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'applications'))
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'applications'));
drop policy if exists documents_service_access on public.documents;
create policy documents_service_access on public.documents as restrictive for all to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),case when document_type like 'cv%' then 'cv' else 'applications' end))
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),case when document_type like 'cv%' then 'cv' else 'applications' end));
drop policy if exists document_reviews_service_access on public.document_reviews;
create policy document_reviews_service_access on public.document_reviews as restrictive for all to authenticated
using (public.current_role() <> 'assistant_admin' or exists(select 1 from public.documents d where d.id = document_id))
with check (public.current_role() <> 'assistant_admin' or exists(select 1 from public.documents d where d.id = document_id));
drop policy if exists support_threads_service_access on public.support_threads;
create policy support_threads_service_access on public.support_threads as restrictive for all to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support'))
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support'));
drop policy if exists support_messages_service_access on public.support_messages;
create policy support_messages_service_access on public.support_messages as restrictive for all to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support'))
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support'));
drop policy if exists callback_service_access on public.callback_requests;
create policy callback_service_access on public.callback_requests as restrictive for all to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support'))
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support'));
drop policy if exists application_updates_service_access on public.application_updates;
create policy application_updates_service_access on public.application_updates as restrictive for all to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'updates'))
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'updates'));
drop policy if exists accommodation_requests_service_access on public.accommodation_requests;
create policy accommodation_requests_service_access on public.accommodation_requests as restrictive for all to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'accommodation'))
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'accommodation'));
drop policy if exists notifications_authorized_staff_insert on public.notifications;
create policy notifications_authorized_staff_insert on public.notifications for insert to authenticated
with check (public.current_role() = 'master_admin'
  or public.current_role() = 'assistant_admin' and public.can_access_user(user_id));
drop policy if exists institutions_delegated_write on public.institutions;
create policy institutions_delegated_write on public.institutions for all to authenticated
using (public.current_role() = 'assistant_admin' and public.assistant_has_service_access(auth.uid(),'institutions'))
with check (public.current_role() = 'assistant_admin' and public.assistant_has_service_access(auth.uid(),'institutions'));
drop policy if exists institutions_service_insert on public.institutions;
create policy institutions_service_insert on public.institutions as restrictive for insert to authenticated
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'institutions'));
drop policy if exists institutions_service_update on public.institutions;
create policy institutions_service_update on public.institutions as restrictive for update to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'institutions'))
with check (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'institutions'));
drop policy if exists institutions_service_delete on public.institutions;
create policy institutions_service_delete on public.institutions as restrictive for delete to authenticated
using (public.current_role() <> 'assistant_admin' or public.assistant_has_service_access(auth.uid(),'institutions'));
drop policy if exists career_draft_scope on public.career_articles;
create policy career_draft_scope on public.career_articles as restrictive for select to authenticated
using (public.current_role() <> 'assistant_admin' or status = 'published'
  or created_by = auth.uid() and public.assistant_has_service_access(auth.uid(),'jobs'));
drop policy if exists housing_draft_scope on public.housing_listings;
create policy housing_draft_scope on public.housing_listings as restrictive for select to authenticated
using (public.current_role() <> 'assistant_admin' or listing_state = 'published'
  or created_by = auth.uid() and public.assistant_has_service_access(auth.uid(),'accommodation'));

drop policy if exists career_articles_assistant_draft_insert on public.career_articles;
create policy career_articles_assistant_draft_insert on public.career_articles
for insert to authenticated with check (
  public.current_role() = 'assistant_admin'
  and public.assistant_has_service_access(auth.uid(),'jobs')
  and created_by = auth.uid() and updated_by = auth.uid()
  and (status = 'draft' or status = 'published' and public.assistant_has_service_access(auth.uid(),'publish_jobs'))
  and content_type in ('job', 'internship')
);
drop policy if exists career_articles_assistant_draft_update on public.career_articles;
create policy career_articles_assistant_draft_update on public.career_articles
for update to authenticated using (
  public.current_role() = 'assistant_admin' and created_by = auth.uid()
  and public.assistant_has_service_access(auth.uid(),'jobs')
  and status = 'draft' and content_type in ('job', 'internship')
) with check (
  public.current_role() = 'assistant_admin' and created_by = auth.uid()
  and public.assistant_has_service_access(auth.uid(),'jobs') and updated_by = auth.uid()
  and (status = 'draft' or status = 'published' and public.assistant_has_service_access(auth.uid(),'publish_jobs'))
  and content_type in ('job', 'internship')
);
drop policy if exists housing_listings_assistant_draft_insert on public.housing_listings;
create policy housing_listings_assistant_draft_insert on public.housing_listings
for insert to authenticated with check (
  public.current_role() = 'assistant_admin'
  and public.assistant_has_service_access(auth.uid(),'accommodation')
  and created_by = auth.uid() and updated_by = auth.uid()
  and listing_state = 'draft' and is_active = true
);
drop policy if exists housing_listings_assistant_draft_update on public.housing_listings;
create policy housing_listings_assistant_draft_update on public.housing_listings
for update to authenticated using (
  public.current_role() = 'assistant_admin' and created_by = auth.uid()
  and public.assistant_has_service_access(auth.uid(),'accommodation')
  and listing_state = 'draft'
) with check (
  public.current_role() = 'assistant_admin' and created_by = auth.uid()
  and public.assistant_has_service_access(auth.uid(),'accommodation')
  and updated_by = auth.uid() and listing_state = 'draft' and is_active = true
);

commit;
notify pgrst, 'reload schema';
