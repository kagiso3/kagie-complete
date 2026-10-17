-- Apply after 20261004_staff_service_drafts.sql. No historical records are deleted.
begin;

-- User-editable Auth metadata must never grant a staff role.
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$
 select coalesce((select role from public.profiles where id=auth.uid()), 'user');
$$;
create or replace function public.guard_profile_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.current_role()<>'master_admin' then
   if TG_OP='INSERT' and new.role<>'user' then raise exception 'Only Master Admin can create staff profiles'; end if;
   if TG_OP='UPDATE' and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then raise exception 'Only Master Admin can change roles or account access'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role before insert or update on public.profiles for each row execute function public.guard_profile_role();
-- Auth inserts occur without an end-user uid, so validate their metadata source too.
create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path=public as $$
declare safe_role text:=coalesce(new.raw_app_meta_data->>'role','user');
begin
 if safe_role not in ('user','assistant_admin','master_admin') then safe_role:='user'; end if;
 insert into public.profiles(id,user_id,full_name,email,role) values(new.id,new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''),safe_role) on conflict(id) do nothing;
 insert into public.user_profiles(user_id) values(new.id) on conflict do nothing;
 insert into public.guardian_profiles(user_id) values(new.id) on conflict do nothing;
 insert into public.school_profiles(user_id) values(new.id) on conflict do nothing;
 insert into public.carts(user_id) values(new.id) on conflict do nothing;
 if safe_role='user' then insert into public.applications(user_id) values(new.id); end if;
 return new;
end; $$;

alter table public.assistant_service_permissions drop constraint if exists assistant_service_permissions_service_key_check;
alter table public.assistant_service_permissions add constraint assistant_service_permissions_service_key_check check(service_key in
 ('applications','support','updates','institutions','accommodation','cv','jobs','publish_jobs',
 'housing_create','housing_edit','housing_availability','housing_requests','housing_publish',
 'cv_edit','cv_message','cv_upload','cv_review','cv_complete','jobs_create','jobs_edit','jobs_submit','jobs_unpublish'));
create or replace function public.assistant_has_service_access(assistant_id_arg uuid,key_arg text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare allowed boolean; parent_key text;
begin
 if public.current_role()='master_admin' then return true; end if;
 if public.current_role()<>'assistant_admin' or assistant_id_arg is distinct from auth.uid() then return false; end if;
 select enabled into allowed from public.assistant_service_permissions where assistant_admin_id=assistant_id_arg and service_key=key_arg;
 if key_arg='institutions' then return coalesce(allowed,false); end if;
 parent_key:=case when key_arg='publish_jobs' then 'jobs' when key_arg like 'housing_%' then 'accommodation' when key_arg like 'cv_%' then 'cv' when key_arg like 'jobs_%' then 'jobs' else key_arg end;
 if key_arg<>parent_key then
   return coalesce(allowed,key_arg not in ('housing_publish','publish_jobs','jobs_unpublish')) and public.assistant_has_service_access(assistant_id_arg,parent_key);
 end if;
 return coalesce(allowed,key_arg in ('applications','support','updates','accommodation','cv','jobs'));
end; $$;

create table if not exists public.cv_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 source_document_id uuid unique references public.documents(id), assigned_assistant_id uuid references public.profiles(id),
 support_thread_id uuid references public.support_threads(id), final_document_id uuid references public.documents(id),
 career_goal text not null default '', learner_note text not null default '', next_question text not null default '',
 draft jsonb not null default '{}'::jsonb, internal_notes text not null default '',
 status text not null default 'New request' check(status in ('New request','Reviewing','Working','Waiting for learner','Ready for review','Ready to send','Completed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cv_versions (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.cv_requests(id),
 draft jsonb not null, status text not null, final_document_id uuid references public.documents(id),
 author_id uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index if not exists cv_requests_assistant_status on public.cv_requests(assigned_assistant_id,status);
create or replace function public.can_access_cv(target_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.cv_requests r where r.id=target_id and
 (public.current_role()='master_admin' or (public.current_role()='assistant_admin' and r.assigned_assistant_id=auth.uid() and public.assistant_has_service_access(auth.uid(),'cv'))));
$$;
-- Learners receive only the public request fields through this RPC, never internal notes.
create or replace function public.my_cv_requests() returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'career_goal',career_goal,'next_question',next_question,'support_thread_id',support_thread_id,'final_document_id',final_document_id,'updated_at',updated_at)),'[]'::jsonb)
 from public.cv_requests where user_id=auth.uid();
$$;
revoke all on function public.my_cv_requests() from public;
grant execute on function public.my_cv_requests() to authenticated;
alter table public.cv_requests enable row level security;
alter table public.cv_versions enable row level security;
drop policy if exists cv_staff_read on public.cv_requests;
create policy cv_staff_read on public.cv_requests for select to authenticated using(public.can_access_cv(id));
drop policy if exists cv_staff_update on public.cv_requests;
create policy cv_staff_update on public.cv_requests for update to authenticated using(public.can_access_cv(id)) with check(public.can_access_cv(id));
drop policy if exists cv_versions_staff_read on public.cv_versions;
create policy cv_versions_staff_read on public.cv_versions for select to authenticated using(public.can_access_cv(request_id));
create or replace function public.guard_cv_request() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.current_role()<>'master_admin' then
   if new.user_id is distinct from old.user_id or new.assigned_assistant_id is distinct from old.assigned_assistant_id or new.source_document_id is distinct from old.source_document_id or new.support_thread_id is distinct from old.support_thread_id then raise exception 'Only Master Admin can assign CV requests'; end if;
   if new.draft is distinct from old.draft and not public.assistant_has_service_access(auth.uid(),'cv_edit') then raise exception 'CV editing is locked'; end if;
   if (new.internal_notes is distinct from old.internal_notes or new.next_question is distinct from old.next_question or new.career_goal is distinct from old.career_goal or new.status is distinct from old.status and new.status not in ('Ready for review','Completed')) and not public.assistant_has_service_access(auth.uid(),'cv_edit') then raise exception 'CV editing is locked'; end if;
   if new.final_document_id is distinct from old.final_document_id and not public.assistant_has_service_access(auth.uid(),'cv_upload') then raise exception 'CV delivery is locked'; end if;
   if new.status is distinct from old.status and new.status='Ready for review' and not public.assistant_has_service_access(auth.uid(),'cv_review') then raise exception 'CV review is locked'; end if;
   if new.status is distinct from old.status and new.status='Completed' and not public.assistant_has_service_access(auth.uid(),'cv_complete') then raise exception 'CV completion is locked'; end if;
 end if;
 if new.final_document_id is not null and not exists(select 1 from public.documents d where d.id=new.final_document_id and d.user_id=new.user_id and d.document_type='cv_revised') then raise exception 'The final CV must belong to this learner'; end if;
 if new.status in ('Ready to send','Completed') and new.final_document_id is null then raise exception 'Upload or generate the final CV first'; end if;
 new.updated_at:=now();
 return new;
end; $$;
drop trigger if exists guard_cv_request on public.cv_requests;
create trigger guard_cv_request before update on public.cv_requests for each row execute function public.guard_cv_request();
create or replace function public.cv_request_version() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.cv_versions(request_id,draft,status,final_document_id,author_id) values(new.id,new.draft,new.status,new.final_document_id,auth.uid());
 return new;
end; $$;
drop trigger if exists cv_request_version on public.cv_requests;
create trigger cv_request_version after insert or update on public.cv_requests for each row execute function public.cv_request_version();
create or replace function public.create_cv_request_from_document() returns trigger language plpgsql security definer set search_path=public as $$
declare thread_id uuid;
begin
 if new.document_type='cv' then
  insert into public.support_threads(user_id,category,subject,status) values(new.user_id,'Career Hub','CV Revamp: '||new.file_name,'open') returning id into thread_id;
  insert into public.cv_requests(user_id,source_document_id,support_thread_id,draft,career_goal,learner_note) values(new.user_id,new.id,thread_id,coalesce(new.metadata->'cvDraft','{}'::jsonb),coalesce(new.metadata#>>'{cvDraft,personal,title}',''),coalesce(new.metadata->>'learnerNote','')) on conflict(source_document_id) do nothing;
 end if;
 return new;
end; $$;
-- The existing document schema uses no structured metadata column; add one safely.
alter table public.documents add column if not exists metadata jsonb not null default '{}'::jsonb;
drop trigger if exists create_cv_request_from_document on public.documents;
create trigger create_cv_request_from_document after insert on public.documents for each row execute function public.create_cv_request_from_document();
-- Historical source CVs become unassigned review requests; preserve the originals.
insert into public.cv_requests(user_id,source_document_id,draft)
select user_id,id,coalesce(metadata->'cvDraft','{}'::jsonb) from public.documents where document_type='cv' on conflict(source_document_id) do nothing;

create or replace function public.can_access_application(target_application_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.applications a where a.id=target_application_id and
 (a.user_id=auth.uid() or public.current_role()='master_admin' or
 (public.current_role()='assistant_admin' and public.assistant_has_service_access(auth.uid(),'applications') and public.assistant_has_form_access(auth.uid(),a.application_type) and
 (a.assistant_id=auth.uid() or exists(select 1 from public.assignments s where s.user_id=a.user_id and s.assistant_admin_id=auth.uid())))));
$$;
-- INSERT ... RETURNING must authorize the new learner row directly. The stable
-- staff lookup can only see applications that existed before this statement.
drop policy if exists applications_self_or_staff on public.applications;
create policy applications_self_or_staff on public.applications for select
using (auth.uid() = user_id or public.can_access_application(id));
create or replace function public.can_access_user(target_user_id uuid) returns boolean language sql stable security definer set search_path=public as $$
 select target_user_id=auth.uid() or public.current_role()='master_admin' or (public.current_role()='assistant_admin' and (
 exists(select 1 from public.applications a where a.user_id=target_user_id and public.can_access_application(a.id)) or
 exists(select 1 from public.cv_requests r where r.user_id=target_user_id and public.can_access_cv(r.id)) or
 (public.assistant_has_service_access(auth.uid(),'support') and exists(select 1 from public.support_threads s where s.user_id=target_user_id and s.assistant_id=auth.uid())) or
 (public.assistant_has_service_access(auth.uid(),'support') and exists(select 1 from public.callback_requests c where c.user_id=target_user_id and c.assigned_assistant_id=auth.uid()))));
$$;
drop policy if exists application_notes_staff_boundary on public.application_notes;
create policy application_notes_staff_boundary on public.application_notes as restrictive for all to authenticated using(public.is_staff() and public.can_access_application(application_id)) with check(public.is_staff() and public.can_access_application(application_id) and author_id=auth.uid());
drop policy if exists support_internal_boundary on public.support_messages;
create policy support_internal_boundary on public.support_messages as restrictive for select to authenticated using(not is_internal or public.is_staff());
drop policy if exists support_sender_boundary on public.support_messages;
create policy support_sender_boundary on public.support_messages as restrictive for insert to authenticated with check(sender_id=auth.uid() and sender_role=public.current_role() and (not is_internal or public.is_staff()));
drop policy if exists support_threads_service_access on public.support_threads;
create policy support_threads_service_access on public.support_threads as restrictive for all to authenticated using(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support') or exists(select 1 from public.cv_requests r where r.support_thread_id=support_threads.id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message'))) with check(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support') or exists(select 1 from public.cv_requests r where r.support_thread_id=support_threads.id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message')));
drop policy if exists support_messages_service_access on public.support_messages;
create policy support_messages_service_access on public.support_messages as restrictive for all to authenticated using(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support') or exists(select 1 from public.cv_requests r where r.support_thread_id=support_messages.thread_id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message'))) with check(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'support') or exists(select 1 from public.cv_requests r where r.support_thread_id=support_messages.thread_id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message')));
drop policy if exists review_author_boundary on public.document_reviews;
create policy review_author_boundary on public.document_reviews as restrictive for insert to authenticated with check(assistant_id=auth.uid());
drop policy if exists activity_actor_boundary on public.assistant_activity;
create policy activity_actor_boundary on public.assistant_activity as restrictive for insert to authenticated with check(assistant_id=auth.uid());
drop policy if exists housing_request_action_boundary on public.accommodation_requests;
create policy housing_request_action_boundary on public.accommodation_requests as restrictive for update to authenticated using(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'housing_requests')) with check(public.current_role()<>'assistant_admin' or public.assistant_has_service_access(auth.uid(),'housing_requests'));
drop policy if exists notification_recipient_boundary on public.notifications;
create policy notification_recipient_boundary on public.notifications as restrictive for insert to authenticated with check(user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and public.can_access_user(user_id));
drop policy if exists document_record_boundary on public.documents;
create policy document_record_boundary on public.documents as restrictive for all to authenticated using(
 user_id=auth.uid() or public.current_role()='master_admin' or
 public.current_role()='assistant_admin' and (case when document_type like 'cv%' then exists(select 1 from public.cv_requests r where r.user_id=documents.user_id and public.can_access_cv(r.id)) else (application_id is not null and public.can_access_application(application_id) or application_id is null and public.can_access_user(user_id) and public.assistant_has_service_access(auth.uid(),'applications')) end)
) with check(user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and (
 document_type like 'cv%' and public.assistant_has_service_access(auth.uid(),'cv_upload') and exists(select 1 from public.cv_requests r where r.user_id=documents.user_id and public.can_access_cv(r.id)) or document_type not like 'cv%' and public.can_access_user(user_id) and (application_id is null or public.can_access_application(application_id))));
create or replace function public.can_access_cv_document(document_id_arg uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.documents d join public.cv_requests r on r.user_id=d.user_id where d.id=document_id_arg and public.can_access_cv(r.id) and
 (r.source_document_id=d.id or r.final_document_id=d.id or d.document_type='cv_revised' and d.metadata->>'cvRequestId'=r.id::text or exists(select 1 from public.cv_versions v where v.request_id=r.id and v.final_document_id=d.id)));
$$;
drop policy if exists cv_document_request_boundary on public.documents;
-- Use the candidate row directly: an INSERT ... RETURNING row is not yet visible
-- to a helper that queries documents again within the same statement snapshot.
create policy cv_document_request_boundary on public.documents as restrictive for select to authenticated using(document_type not like 'cv%' or user_id=auth.uid() or public.current_role()='master_admin' or exists(
 select 1 from public.cv_requests r where r.user_id=documents.user_id and public.can_access_cv(r.id) and (r.source_document_id=documents.id or r.final_document_id=documents.id or documents.document_type='cv_revised' and documents.metadata->>'cvRequestId'=r.id::text or exists(select 1 from public.cv_versions v where v.request_id=r.id and v.final_document_id=documents.id))));
drop policy if exists cv_document_write_boundary on public.documents;
create policy cv_document_write_boundary on public.documents as restrictive for insert to authenticated with check(document_type not like 'cv%' or user_id=auth.uid() or public.current_role()='master_admin' or document_type='cv_revised' and exists(select 1 from public.cv_requests r where r.user_id=documents.user_id and r.id::text=documents.metadata->>'cvRequestId' and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_upload')));
drop policy if exists support_work_boundary on public.support_threads;
create policy support_work_boundary on public.support_threads as restrictive for all to authenticated using(user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and (
 exists(select 1 from public.cv_requests r where r.support_thread_id=support_threads.id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message')) or
 public.assistant_has_service_access(auth.uid(),'support') and (assistant_id=auth.uid() or exists(select 1 from public.applications a where a.user_id=support_threads.user_id and public.can_access_application(a.id)))
)) with check(user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and (
 exists(select 1 from public.cv_requests r where r.support_thread_id=support_threads.id and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_message')) or
 public.assistant_has_service_access(auth.uid(),'support') and (assistant_id=auth.uid() or exists(select 1 from public.applications a where a.user_id=support_threads.user_id and public.can_access_application(a.id)))
));

alter table public.career_articles add column if not exists approval_state text not null default 'draft' check(approval_state in ('draft','submitted','approved','rejected'));
alter table public.career_articles add column if not exists submitted_at timestamptz;
alter table public.career_articles add column if not exists expires_at timestamptz;
alter table public.career_articles add column if not exists salary text not null default '';
alter table public.housing_listings add column if not exists assigned_assistant_id uuid references public.profiles(id);
alter table public.housing_listings add column if not exists deposit numeric(10,2) not null default 0;
alter table public.housing_listings add column if not exists rooms integer not null default 0;
alter table public.housing_listings add column if not exists amenities text[] not null default '{}';
alter table public.housing_listings add column if not exists available_from date;
create or replace function public.guard_staff_content() returns trigger language plpgsql security definer set search_path=public as $$
declare is_career boolean:=TG_TABLE_NAME='career_articles'; key_name text;
begin
 if auth.uid() is null then return new; end if;
 if public.current_role()='master_admin' then new.updated_by:=auth.uid(); return new; end if;
 if public.current_role()<>'assistant_admin' then raise exception 'Staff content is restricted'; end if;
 if TG_OP='INSERT' then
   new.created_by:=auth.uid(); key_name:=case when is_career then 'jobs_create' else 'housing_create' end;
   if not is_career then if new.assigned_assistant_id is not null then raise exception 'Only Master Admin assigns housing listings'; end if; end if;
 else
   if new.created_by is distinct from old.created_by then raise exception 'Content ownership cannot be changed'; end if;
   key_name:=case when is_career then 'jobs_edit' else 'housing_edit' end;
   if is_career then
     if old.status='published' and new.status='draft' and (to_jsonb(new)-array['status','approval_state','updated_at','updated_by']) is not distinct from (to_jsonb(old)-array['status','approval_state','updated_at','updated_by']) then key_name:='jobs_unpublish'; end if;
   end if;
   if not is_career then
     if (to_jsonb(new)-array['availability_status','updated_at','updated_by']) is not distinct from (to_jsonb(old)-array['availability_status','updated_at','updated_by']) then key_name:='housing_availability'; end if;
   end if;
   if not is_career then
     if new.assigned_assistant_id is distinct from old.assigned_assistant_id then raise exception 'Only Master Admin assigns housing listings'; end if;
   end if;
 end if;
 if not public.assistant_has_service_access(auth.uid(),key_name) then raise exception 'Content editing is locked'; end if;
 if is_career then
   if new.content_type not in ('job','internship') then raise exception 'Assistants can edit opportunities only'; end if;
   if new.approval_state='submitted' then
     if not public.assistant_has_service_access(auth.uid(),'jobs_submit') then raise exception 'Opportunity submission is locked'; end if;
     new.submitted_at:=now();
   elsif new.approval_state not in ('draft','submitted') then raise exception 'Only Master Admin reviews submitted opportunities'; end if;
   if new.status='published' and not public.assistant_has_service_access(auth.uid(),'publish_jobs') then raise exception 'Publication requires Master Admin approval'; end if;
   if TG_OP='UPDATE' and old.status='published' and new.status<>'published' and not public.assistant_has_service_access(auth.uid(),'jobs_unpublish') then raise exception 'Unpublishing is locked'; end if;
 else
   if TG_OP='INSERT' then
     if new.listing_state='published' and not public.assistant_has_service_access(auth.uid(),'housing_publish') then raise exception 'Housing publication is locked'; end if;
   elsif new.listing_state is distinct from old.listing_state and (new.listing_state='published' or old.listing_state='published') and not public.assistant_has_service_access(auth.uid(),'housing_publish') then raise exception 'Housing publication is locked'; end if;
   if TG_OP='UPDATE' and new.availability_status is distinct from old.availability_status and not public.assistant_has_service_access(auth.uid(),'housing_availability') then raise exception 'Housing availability is locked'; end if;
 end if;
 new.updated_by:=auth.uid(); return new;
end; $$;
drop trigger if exists guard_staff_content on public.career_articles;
create trigger guard_staff_content before insert or update on public.career_articles for each row execute function public.guard_staff_content();
drop trigger if exists guard_staff_content on public.housing_listings;
create trigger guard_staff_content before insert or update on public.housing_listings for each row execute function public.guard_staff_content();
drop policy if exists career_articles_assistant_draft_update on public.career_articles;
create policy career_articles_assistant_draft_update on public.career_articles for update to authenticated using(public.current_role()='assistant_admin' and created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'jobs') and (status='draft' and approval_state in ('draft','rejected') or public.assistant_has_service_access(auth.uid(),'publish_jobs') or status='published' and public.assistant_has_service_access(auth.uid(),'jobs_unpublish'))) with check(created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'jobs') and (status='draft' or status='published' and public.assistant_has_service_access(auth.uid(),'publish_jobs')));
drop policy if exists housing_listings_assistant_draft_update on public.housing_listings;
create policy housing_listings_assistant_draft_update on public.housing_listings for update to authenticated using(public.current_role()='assistant_admin' and (created_by=auth.uid() or assigned_assistant_id=auth.uid()) and public.assistant_has_service_access(auth.uid(),'accommodation')) with check(public.current_role()='assistant_admin' and (created_by=auth.uid() or assigned_assistant_id=auth.uid()) and public.assistant_has_service_access(auth.uid(),'accommodation'));
drop policy if exists housing_listings_assistant_draft_insert on public.housing_listings;
create policy housing_listings_assistant_draft_insert on public.housing_listings for insert to authenticated with check(public.current_role()='assistant_admin' and created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'housing_create') and (listing_state='draft' or listing_state='published' and public.assistant_has_service_access(auth.uid(),'housing_publish')));
drop policy if exists housing_assistant_visibility on public.housing_listings;
create policy housing_assistant_visibility on public.housing_listings for select to authenticated using(public.current_role()='assistant_admin' and assigned_assistant_id=auth.uid() and public.assistant_has_service_access(auth.uid(),'accommodation'));
drop policy if exists housing_draft_scope on public.housing_listings;
create policy housing_draft_scope on public.housing_listings as restrictive for select to authenticated using(public.current_role()<>'assistant_admin' or listing_state='published' or public.assistant_has_service_access(auth.uid(),'accommodation') and (created_by=auth.uid() or assigned_assistant_id=auth.uid()));
-- Expired opportunities disappear even if a background expiry job is unavailable.
drop policy if exists career_expiry on public.career_articles;
create policy career_expiry on public.career_articles as restrictive for select using(public.is_staff() or expires_at is null or expires_at>now());

create or replace function public.guard_application_staff_fields() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and public.current_role()<>'master_admin' then
   if TG_OP='UPDATE' and (new.assistant_id is distinct from old.assistant_id or new.user_id is distinct from old.user_id or new.assigned_by is distinct from old.assigned_by) then raise exception 'Only Master Admin assigns applications'; end if;
   if TG_OP='UPDATE' and public.current_role()='assistant_admin' and new.application_type is distinct from old.application_type then raise exception 'Only Master Admin can change an application form type'; end if;
   if TG_OP='INSERT' and new.assistant_id is not null then raise exception 'Only Master Admin assigns applications'; end if;
   if public.current_role()='assistant_admin' and new.payment_status is distinct from old.payment_status then raise exception 'Only Master Admin reviews payments'; end if;
   if public.current_role()='user' and new.payment_status in ('Verified','Rejected','Refunded') and (TG_OP='INSERT' or new.payment_status is distinct from old.payment_status) then raise exception 'Payment review is restricted'; end if;
 end if;
 if auth.uid() is not null and public.current_role()='master_admin' and new.assistant_id is not null and (TG_OP='INSERT' or new.assistant_id is distinct from old.assistant_id) then
   if not exists(select 1 from public.profiles p where p.id=new.assistant_id and p.role='assistant_admin') or
      not coalesce((select enabled from public.assistant_form_permissions where assistant_admin_id=new.assistant_id and form_type=public.normalize_application_type(new.application_type)),not exists(select 1 from public.assistant_form_permissions where assistant_admin_id=new.assistant_id)) then raise exception 'Choose an assistant with access to this form'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists guard_application_staff_fields on public.applications;
create trigger guard_application_staff_fields before insert or update on public.applications for each row execute function public.guard_application_staff_fields();

-- Restrictive policies still apply if older permissive storage policies remain installed.
create or replace function public.can_read_kagie_file(path_arg text) returns boolean language sql stable security definer set search_path=public as $$
 select public.current_role()='master_admin' or
 split_part(path_arg,'/',1)=auth.uid()::text or
 -- These existing namespaces contain public learning resources, never learner uploads.
 path_arg ~ '^prospectus/[A-Za-z0-9_-]+/[^/]+\.pdf$' or path_arg='past-papers/catalog.json' or
 path_arg ~ '^past-papers/.+\.pdf$' and not exists(select 1 from public.question_papers q where (q.remote_path=path_arg or q.file_url=path_arg) and q.status<>'Published') or
 exists(select 1 from public.documents d where d.file_url=path_arg and
 (d.user_id=auth.uid() or public.current_role()='assistant_admin' and (case when d.document_type like 'cv%' then public.can_access_cv_document(d.id) else public.assistant_has_service_access(auth.uid(),'applications') and (d.application_id is not null and public.can_access_application(d.application_id) or d.application_id is null and public.can_access_user(d.user_id)) end))) or
 exists(select 1 from public.career_articles c where (c.image_url=path_arg or c.file_url=path_arg) and (c.status='published' and (c.expires_at is null or c.expires_at>now()) or c.created_by=auth.uid() and public.current_role()='assistant_admin' and public.assistant_has_service_access(auth.uid(),'jobs'))) or
 exists(select 1 from public.housing_listings h where h.images ? path_arg and (h.listing_state='published' and h.is_active or public.current_role()='assistant_admin' and public.assistant_has_service_access(auth.uid(),'accommodation') and (h.created_by=auth.uid() or h.assigned_assistant_id=auth.uid()))) or
 exists(select 1 from public.question_papers q where (q.remote_path=path_arg or q.file_url=path_arg) and q.status='Published');
$$;
create or replace function public.can_write_kagie_file(path_arg text) returns boolean language sql stable security definer set search_path=public as $$
 select public.current_role()='master_admin' or
 (not exists(select 1 from public.career_articles c where (c.image_url=path_arg or c.file_url=path_arg) and (c.status='published' or c.approval_state='submitted') and not (c.created_by=auth.uid() and public.assistant_has_service_access(auth.uid(),'publish_jobs'))) and
 not exists(select 1 from public.housing_listings h where h.images ? path_arg and h.listing_state='published' and not ((h.created_by=auth.uid() or h.assigned_assistant_id=auth.uid()) and public.assistant_has_service_access(auth.uid(),'housing_publish'))) and
 (split_part(path_arg,'/',1)=auth.uid()::text or
 public.current_role()='assistant_admin' and (
 path_arg like 'career-hub/image/'||auth.uid()||'/%' and (public.assistant_has_service_access(auth.uid(),'jobs_create') or public.assistant_has_service_access(auth.uid(),'jobs_edit')) or
 path_arg like 'housing/'||auth.uid()||'/%' and (public.assistant_has_service_access(auth.uid(),'housing_create') or public.assistant_has_service_access(auth.uid(),'housing_edit')) or
 not exists(select 1 from public.documents d where d.file_url=path_arg) and exists(select 1 from public.cv_requests r where split_part(path_arg,'/',1)=r.user_id::text and public.can_access_cv(r.id) and public.assistant_has_service_access(auth.uid(),'cv_upload')))));
$$;
drop policy if exists kagie_file_read_boundary on storage.objects;
create policy kagie_file_read_boundary on storage.objects as restrictive for select using(bucket_id<>'kagie-documents' or public.can_read_kagie_file(name));
drop policy if exists kagie_file_insert_boundary on storage.objects;
create policy kagie_file_insert_boundary on storage.objects as restrictive for insert with check(bucket_id<>'kagie-documents' or public.can_write_kagie_file(name));
drop policy if exists kagie_file_update_boundary on storage.objects;
create policy kagie_file_update_boundary on storage.objects as restrictive for update using(bucket_id<>'kagie-documents' or public.can_write_kagie_file(name)) with check(bucket_id<>'kagie-documents' or public.can_write_kagie_file(name));
revoke all on function public.can_read_kagie_file(text),public.can_write_kagie_file(text),public.can_access_cv(uuid) from public;
grant execute on function public.can_read_kagie_file(text),public.can_write_kagie_file(text),public.can_access_cv(uuid) to authenticated;
grant select,update on public.cv_requests to authenticated;
grant select on public.cv_versions to authenticated;

create table if not exists public.payment_reviews(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications(id),reviewer_id uuid references public.profiles(id),status text not null,reason text not null default '',created_at timestamptz not null default now());
alter table public.payment_reviews enable row level security;
drop policy if exists payment_review_read on public.payment_reviews;
create policy payment_review_read on public.payment_reviews for select to authenticated using(public.can_access_application(application_id));
drop policy if exists payment_review_insert on public.payment_reviews;
create policy payment_review_insert on public.payment_reviews for insert to authenticated with check(public.current_role()='master_admin' and reviewer_id=auth.uid());
grant select,insert on public.payment_reviews to authenticated;
create or replace function public.staff_review_payment(application_id_arg uuid,status_arg text,reason_arg text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare result public.applications;
begin
 if public.current_role()<>'master_admin' then raise exception 'Only Master Admin reviews payments'; end if;
 if status_arg not in ('Pending Verification','Verified','Rejected') or status_arg='Rejected' and trim(coalesce(reason_arg,''))='' then raise exception 'Choose a decision and provide a rejection reason'; end if;
 update public.applications set payment_status=status_arg where id=application_id_arg returning * into result;
 if result.id is null then raise exception 'Application unavailable'; end if;
 insert into public.payment_reviews(application_id,reviewer_id,status,reason) values(application_id_arg,auth.uid(),status_arg,reason_arg);
 return jsonb_build_object('id',result.id,'payment_status',result.payment_status);
end; $$;
create or replace function public.staff_review_document(document_id_arg uuid,status_arg text,note_arg text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare result public.documents;
begin
 if not public.is_staff() or status_arg not in ('Pending Review','Approved','Rejected') or status_arg='Rejected' and trim(coalesce(note_arg,''))='' then raise exception 'Staff review and a useful rejection reason are required'; end if;
 update public.documents set status=status_arg where id=document_id_arg returning * into result;
 if result.id is null then raise exception 'Document unavailable or access denied'; end if;
 insert into public.document_reviews(document_id,assistant_id,status,note) values(document_id_arg,auth.uid(),status_arg,note_arg);
 insert into public.notifications(user_id,title,message,notification_type) values(result.user_id,'Document reviewed',result.file_name||': '||status_arg||case when note_arg<>'' then '. '||note_arg else '' end,'info');
 return jsonb_build_object('id',result.id,'status',result.status);
end; $$;
revoke all on function public.staff_review_payment(uuid,text,text),public.staff_review_document(uuid,text,text) from public;
grant execute on function public.staff_review_payment(uuid,text,text),public.staff_review_document(uuid,text,text) to authenticated;
drop policy if exists payment_master_write_boundary on public.payments;
create policy payment_master_write_boundary on public.payments as restrictive for update to authenticated using(public.current_role()='master_admin') with check(public.current_role()='master_admin');

create or replace function public.staff_audit_mutation() returns trigger language plpgsql security definer set search_path=public as $$
declare target_app uuid;
begin
 if auth.uid() is not null and public.is_staff() then
   if TG_TABLE_NAME='applications' then target_app:=new.id;
   elsif TG_TABLE_NAME in ('application_notes','application_updates','payment_reviews') then target_app:=new.application_id;
   end if;
   insert into public.assistant_activity(assistant_id,application_id,action,details) values(auth.uid(),target_app,lower(TG_OP)||'_'||TG_TABLE_NAME,jsonb_build_object('recordId',coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'assistant_admin_id')));
 end if;
 return new;
end; $$;
do $$ declare table_name text; begin
 foreach table_name in array array['applications','application_notes','application_updates','documents','document_reviews','callback_requests','career_articles','housing_listings','cv_requests','payment_reviews','assistant_form_permissions','assistant_service_permissions'] loop
   execute format('drop trigger if exists staff_audit_mutation on public.%I',table_name);
   execute format('create trigger staff_audit_mutation after insert or update on public.%I for each row execute function public.staff_audit_mutation()',table_name);
 end loop;
end; $$;
create or replace function public.staff_capabilities() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.is_staff() then raise exception 'Staff access required'; end if;
 return jsonb_build_object('migration','20261004b','role',public.current_role(),'document_bucket',exists(select 1 from storage.buckets where id='kagie-documents' and not public), 'cv_requests',to_regclass('public.cv_requests') is not null,'private_file_policies',(select count(*)=3 from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('kagie_file_read_boundary','kagie_file_insert_boundary','kagie_file_update_boundary')));
end; $$;
create or replace function public.staff_save_portal(application_id_arg uuid,entries_arg jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare payload jsonb; result_id uuid;
begin
 if not public.is_staff() or not public.can_access_application(application_id_arg) then raise exception 'Application unavailable or access denied'; end if;
 if jsonb_typeof(entries_arg)<>'array' then raise exception 'Portal entries must be an array'; end if;
 select coalesce(application_payload,'{}'::jsonb) into payload from public.applications where id=application_id_arg for update;
 payload:=jsonb_set(payload,'{forms}',coalesce(payload->'forms','{}'::jsonb),true);
 payload:=jsonb_set(payload,'{forms,portalAccess}',entries_arg,true);
 update public.applications set application_payload=payload where id=application_id_arg returning id into result_id;
 if result_id is null then raise exception 'Application unavailable'; end if;
 insert into public.application_notes(application_id,author_id,author_role,note) values(application_id_arg,auth.uid(),public.current_role(),'__KAGIE_PORTAL_ACCESS__'||jsonb_build_object('entries',entries_arg)::text);
 return jsonb_build_object('id',result_id);
end; $$;
create or replace function public.cv_delivery_notice() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status in ('Ready to send','Completed') and new.status is distinct from old.status then
 insert into public.notifications(user_id,title,message,notification_type) values(new.user_id,'Your revised CV is ready','Your final CV is available in Documents. Open your CV support conversation for feedback.','info');
 end if;return new;
end; $$;
drop trigger if exists cv_delivery_notice on public.cv_requests;
create trigger cv_delivery_notice after update on public.cv_requests for each row execute function public.cv_delivery_notice();
create or replace function public.staff_start_cv_conversation(request_id_arg uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare r public.cv_requests; thread_id uuid;
begin
 if public.current_role()<>'master_admin' then raise exception 'Only Master Admin can link historical CV conversations'; end if;
 select * into r from public.cv_requests where id=request_id_arg for update;
 if r.id is null then raise exception 'CV request unavailable'; end if;
 if r.support_thread_id is not null then return r.support_thread_id; end if;
 insert into public.support_threads(user_id,category,subject,status) values(r.user_id,'Career Hub','CV Revamp conversation','open') returning id into thread_id;
 update public.cv_requests set support_thread_id=thread_id where id=r.id;
 return thread_id;
end; $$;
revoke all on function public.staff_capabilities(),public.staff_save_portal(uuid,jsonb),public.staff_start_cv_conversation(uuid) from public;
grant execute on function public.staff_capabilities(),public.staff_save_portal(uuid,jsonb),public.staff_start_cv_conversation(uuid) to authenticated;
revoke all on function public.can_access_cv_document(uuid) from public;
grant execute on function public.can_access_cv_document(uuid) to authenticated;
commit;
