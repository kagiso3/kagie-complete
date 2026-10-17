-- LOCAL REVIEW MIGRATION: not applied to any cloud database.
-- Verified against the live catalog snapshot from 2026-10-15.
-- Does not delete, promote, or rewrite existing user records.
begin;

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists profile_image text not null default '';
alter table public.documents
  add column if not exists file_size bigint not null default 0,
  add column if not exists mime_type text not null default '';
alter table public.question_papers
  add column if not exists remote_path text not null default '',
  add column if not exists file_name text not null default '';
alter table public.support_messages add column if not exists is_internal boolean not null default false;
alter table public.support_threads
  add column if not exists subject text not null default '',
  add column if not exists category text not null default '';
alter table public.applications add column if not exists application_payload jsonb not null default '{}';

-- Enforced by the Storage API before accepting new uploads. Existing objects are
-- retained. This bucket also stores the public past-paper JSON catalog, and some
-- browsers identify Word documents as octet-stream; keep those two compatibility
-- MIME types alongside the advertised document formats and WEBP staff images.
update storage.buckets set
  public=false,
  file_size_limit=8388608,
  allowed_mime_types=array[
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg','image/png','image/webp','application/json','application/octet-stream'
  ]::text[]
where id='kagie-documents';

create schema if not exists kagie_private;
revoke all on schema kagie_private from public;
grant usage on schema kagie_private to anon, authenticated;

-- Only the Auth Admin API / service role can modify raw_app_meta_data.
-- Do not fall back to profiles.role: the old live policy allowed self-editing it.
create or replace function public.current_role()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select case when u.raw_app_meta_data->>'role' in
    ('user','assistant_admin','master_admin') then u.raw_app_meta_data->>'role'
    else 'user' end from auth.users u where u.id = auth.uid() and u.deleted_at is null and
    (u.banned_until is null or u.banned_until<=now()) and
    coalesce((select p.is_active from public.profiles p where p.id=u.id),true)), 'user');
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.current_role() in ('assistant_admin','master_admin');
$$;
revoke all on function public.current_role(), public.is_staff() from public;
grant execute on function public.current_role(), public.is_staff() to anon, authenticated, service_role;

create or replace function kagie_private.account_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and
    exists(select 1 from auth.users u where u.id=auth.uid() and u.deleted_at is null and
      (u.banned_until is null or u.banned_until<=now())) and
    coalesce((select p.is_active from public.profiles p where p.id=auth.uid()),true);
$$;
create or replace function kagie_private.staff_can_access_user(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select kagie_private.account_active() and (public.current_role()='master_admin' or
    public.current_role()='assistant_admin' and (
      exists(select 1 from public.applications a where a.user_id=target_user_id and a.assistant_id=auth.uid()) or
      exists(select 1 from public.assistant_assignments a where a.user_id=target_user_id and a.assistant_admin_id=auth.uid()) or
      exists(select 1 from public.support_threads t where t.user_id=target_user_id and t.assistant_id=auth.uid()) or
      exists(select 1 from public.callback_requests c where c.user_id=target_user_id and c.assigned_assistant_id=auth.uid())));
$$;
create or replace function kagie_private.can_access_user(target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select kagie_private.account_active() and
    (target_user_id=auth.uid() or kagie_private.staff_can_access_user(target_user_id));
$$;
create or replace function kagie_private.can_access_application(target_application_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select kagie_private.account_active() and exists(select 1 from public.applications a where a.id=target_application_id and
    (a.user_id=auth.uid() or public.current_role()='master_admin' or public.current_role()='assistant_admin' and
      (a.assistant_id=auth.uid() or exists(select 1 from public.assistant_assignments s
        where s.user_id=a.user_id and s.assistant_admin_id=auth.uid()))));
$$;

create or replace function kagie_private.guard_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and public.current_role()<>'master_admin' then
    if TG_OP='INSERT' and (coalesce(new.role,'user')<>'user' or not new.is_active or
      new.id<>auth.uid() or new.user_id is not null and new.user_id<>new.id) then
      raise exception 'Only Master Admin can create staff profiles or change account access' using errcode='42501';
    end if;
    if TG_OP='UPDATE' and (new.id is distinct from old.id or
      new.user_id is distinct from old.user_id and not (old.user_id is null and new.user_id=new.id) or
      new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
      raise exception 'Only Master Admin can change roles, ownership, or account access' using errcode='42501';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists kagie_audit_profile_guard on public.profiles;
create trigger kagie_audit_profile_guard before insert or update on public.profiles
for each row execute function kagie_private.guard_profile_fields();

-- Google/email signup remains a learner unless trusted app metadata says otherwise.
-- Keep child-record provisioning atomic: a failure must not masquerade as success.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare safe_role text := coalesce(new.raw_app_meta_data->>'role','user');
begin
  if safe_role not in ('user','assistant_admin','master_admin') then safe_role:='user'; end if;
  insert into public.profiles(id,user_id,full_name,email,role)
  values(new.id,new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),coalesce(new.email,''),safe_role)
  on conflict(id) do nothing;
  insert into public.user_profiles(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.guardian_profiles(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.school_profiles(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.carts(user_id) values(new.id) on conflict(user_id) do nothing;
  if safe_role='user' then insert into public.applications(user_id) values(new.id); end if;
  return new;
end; $$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop policy if exists kagie_audit_profiles_select on public.profiles;
create policy kagie_audit_profiles_select on public.profiles as restrictive for select to authenticated
using(kagie_private.can_access_user(id) or id=auth.uid());
drop policy if exists kagie_audit_profiles_update on public.profiles;
create policy kagie_audit_profiles_update on public.profiles as restrictive for update to authenticated
using(kagie_private.account_active() and (id=auth.uid() or public.current_role()='master_admin'))
with check(kagie_private.account_active() and (id=auth.uid() or public.current_role()='master_admin'));
-- Required by the existing client upsert for a profile missing its bootstrap row.
drop policy if exists kagie_audit_profiles_insert on public.profiles;
create policy kagie_audit_profiles_insert on public.profiles for insert to authenticated
with check(kagie_private.account_active() and (id=auth.uid() and coalesce(role,'user')='user' or public.current_role()='master_admin'));

-- Restrictive policies close broad legacy is_staff() grants without removing history.
do $$ declare target_table text; begin
  foreach target_table in array array['user_profiles','guardian_profiles','school_profiles','carts','documents','support_threads','callback_requests'] loop
    execute format('drop policy if exists kagie_audit_user_boundary on public.%I',target_table);
    execute format('create policy kagie_audit_user_boundary on public.%I as restrictive for all to authenticated using(kagie_private.can_access_user(user_id)) with check(kagie_private.can_access_user(user_id))',target_table);
  end loop;
end; $$;
drop policy if exists kagie_audit_application_boundary on public.applications;
create policy kagie_audit_application_boundary on public.applications as restrictive for all to authenticated
using(kagie_private.account_active() and
  (user_id=auth.uid() or public.current_role()='master_admin' or kagie_private.can_access_application(id)))
with check(kagie_private.account_active() and
  (user_id=auth.uid() or public.current_role()='master_admin' or kagie_private.can_access_application(id)));
do $$ declare target_table text; begin
  foreach target_table in array array['application_marks','application_institutions','payments'] loop
    execute format('drop policy if exists kagie_audit_application_child_boundary on public.%I',target_table);
    execute format('create policy kagie_audit_application_child_boundary on public.%I as restrictive for all to authenticated using(kagie_private.can_access_application(application_id)) with check(kagie_private.can_access_application(application_id))',target_table);
  end loop;
end; $$;
drop policy if exists kagie_audit_cart_boundary on public.cart_items;
create policy kagie_audit_cart_boundary on public.cart_items as restrictive for all to authenticated
using(exists(select 1 from public.carts c where c.id=cart_id and kagie_private.can_access_user(c.user_id)))
with check(exists(select 1 from public.carts c where c.id=cart_id and kagie_private.can_access_user(c.user_id)));
alter table public.assistant_assignments enable row level security;
drop policy if exists kagie_audit_assignment_read on public.assistant_assignments;
create policy kagie_audit_assignment_read on public.assistant_assignments for select to authenticated
using(kagie_private.account_active() and (public.current_role()='master_admin' or
  public.current_role()='assistant_admin' and assistant_admin_id=auth.uid()));
drop policy if exists kagie_audit_assignment_write on public.assistant_assignments;
create policy kagie_audit_assignment_write on public.assistant_assignments for all to authenticated
using(kagie_private.account_active() and public.current_role()='master_admin')
with check(kagie_private.account_active() and public.current_role()='master_admin');

create or replace function kagie_private.guard_application_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(new.application_payload)<>'object' then raise exception 'Application data must be an object'; end if;
  if auth.uid() is not null and public.current_role()<>'master_admin' then
    if TG_OP='INSERT' then
      if new.assistant_id is not null then raise exception 'Only Master Admin assigns applications' using errcode='42501'; end if;
      if public.current_role()='user' and (new.payment_status<>'Payment Pending' or new.status not in ('Draft','Package Selected','Awaiting Payment')) then
        raise exception 'Payment verification and staff progress require trusted review' using errcode='42501';
      end if;
      if public.current_role()='user' and coalesce(new.application_payload->'services','[]'::jsonb)<>'[]'::jsonb then
        raise exception 'Paid service fulfillment is managed by the server' using errcode='42501';
      end if;
    else
      if new.user_id is distinct from old.user_id or new.assistant_id is distinct from old.assistant_id then
        raise exception 'Only Master Admin changes application ownership or assignments' using errcode='42501';
      end if;
      if public.current_role()='assistant_admin' and new.payment_status is distinct from old.payment_status then
        raise exception 'Only Master Admin reviews payments' using errcode='42501';
      end if;
      if public.current_role()='user' then
        if coalesce(new.application_payload->'services','[]'::jsonb) is distinct from coalesce(old.application_payload->'services','[]'::jsonb) then
          raise exception 'Paid service fulfillment is managed by the server' using errcode='42501';
        end if;
        if new.payment_status is distinct from old.payment_status and not
          (old.payment_status='Payment Pending' and new.payment_status='Pending Verification') then
          raise exception 'Payment verification requires trusted review' using errcode='42501';
        end if;
        if old.payment_status='Verified' and
          (new.payment_amount is distinct from old.payment_amount or new.payment_method is distinct from old.payment_method or
           new.payment_reference is distinct from old.payment_reference or new.payment_note is distinct from old.payment_note or
           new.package_id is distinct from old.package_id) then
          raise exception 'A settled payment cannot be edited by a learner' using errcode='42501';
        end if;
        if (new.payment_method is distinct from old.payment_method or new.payment_note is distinct from old.payment_note) and
          (lower(coalesce(new.payment_method,'')) in ('payfast','yoco','card') or
           coalesce(new.payment_note,'') ~* '"(gateway|provider|paidAt|gatewayStatus|gatewayCheckoutId|gatewayPaymentId)"') then
          raise exception 'Gateway payment metadata is managed by the server' using errcode='42501';
        end if;
        if new.status is distinct from old.status and new.status not in
          ('Draft','Package Selected','Awaiting Payment','Pending Details','Incomplete','Submitted','Cancelled') then
          raise exception 'Staff application progress cannot be set by a learner' using errcode='42501';
        end if;
        if new.status in ('Pending Details','Submitted') and new.status is distinct from old.status and old.payment_status<>'Verified' then
          raise exception 'Verified payment is required before submitting details' using errcode='42501';
        end if;
      end if;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists kagie_audit_application_guard on public.applications;
create trigger kagie_audit_application_guard before insert or update on public.applications
for each row execute function kagie_private.guard_application_fields();

create or replace function kagie_private.guard_payment_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
declare payload jsonb:=to_jsonb(new);
begin
  if coalesce(payload->>'user_id','')<>'' and not exists(select 1 from public.applications a
    where a.id=new.application_id and a.user_id::text=payload->>'user_id') then
    raise exception 'Payment owner must match its application learner' using errcode='42501';
  end if;
  if auth.uid() is not null and public.current_role()<>'master_admin' then
    if TG_OP='UPDATE' and new.application_id is distinct from old.application_id then
      raise exception 'Payment application ownership cannot be reassigned' using errcode='42501';
    end if;
    if new.status not in ('Payment Pending','Pending Verification') or
      lower(coalesce(new.method,'')) in ('payfast','yoco','card','online','gateway') or
      coalesce(payload->>'provider','')<>'' or coalesce(payload->>'gateway_checkout_id','')<>'' or
      coalesce(payload->>'gateway_payment_id','')<>'' or coalesce(payload->>'gateway_status','')<>'' or
      coalesce(payload->>'paid_at','')<>'' then
      raise exception 'Gateway and verified payments are managed by trusted server review' using errcode='42501';
    end if;
  end if;
  if new.amount<0 then raise exception 'Payment amount cannot be negative'; end if;
  return new;
end; $$;
drop trigger if exists kagie_audit_payment_guard on public.payments;
create trigger kagie_audit_payment_guard before insert or update on public.payments
for each row execute function kagie_private.guard_payment_fields();

-- User-owned rows cannot be moved between learners and staff assignments stay trusted.
create or replace function kagie_private.guard_owned_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changed jsonb:=to_jsonb(new); previous jsonb;
begin
  if auth.uid() is not null and public.current_role()<>'master_admin' then
    if TG_OP='UPDATE' then
      previous:=to_jsonb(old);
      if changed->'user_id' is distinct from previous->'user_id' then
        raise exception 'Record ownership cannot be reassigned' using errcode='42501';
      end if;
      if TG_TABLE_NAME in ('support_threads','callback_requests') and
        (changed->'assistant_id' is distinct from previous->'assistant_id' or
         changed->'assigned_assistant_id' is distinct from previous->'assigned_assistant_id') then
        raise exception 'Only Master Admin can change staff assignments' using errcode='42501';
      end if;
      if TG_TABLE_NAME='support_messages' and (changed->'thread_id' is distinct from previous->'thread_id' or
        changed->'sender_id' is distinct from previous->'sender_id' or changed->'sender_role' is distinct from previous->'sender_role') then
        raise exception 'Message ownership and sender cannot be reassigned' using errcode='42501';
      end if;
    elsif TG_TABLE_NAME in ('support_threads','callback_requests') and
      (coalesce(changed->>'assistant_id','')<>'' or coalesce(changed->>'assigned_assistant_id','')<>'') then
      raise exception 'Only Master Admin can assign staff' using errcode='42501';
    end if;
  end if;
  return new;
end; $$;
do $$ declare target_table text; begin
  foreach target_table in array array['user_profiles','guardian_profiles','school_profiles','carts','support_threads','callback_requests','support_messages'] loop
    execute format('drop trigger if exists kagie_audit_owner_guard on public.%I',target_table);
    execute format('create trigger kagie_audit_owner_guard before insert or update on public.%I for each row execute function kagie_private.guard_owned_fields()',target_table);
  end loop;
end; $$;

create or replace function kagie_private.guard_document_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.application_id is not null and not exists(select 1 from public.applications a where a.id=new.application_id and a.user_id=new.user_id) then
    raise exception 'A document must belong to its application learner' using errcode='42501';
  end if;
  if (TG_OP='INSERT' or new.file_url is distinct from old.file_url) and
    (split_part(new.file_url,'/',1)<>new.user_id::text or new.file_url ~ '(^|/)\.\.(/|$)' or new.file_url ~ '^[a-z]+:') then
    raise exception 'Learner documents must use their private owner folder' using errcode='42501';
  end if;
  if auth.uid() is not null and public.current_role()<>'master_admin' then
    if TG_OP='UPDATE' and (new.user_id is distinct from old.user_id or new.application_id is distinct from old.application_id or
      new.file_url is distinct from old.file_url) then
      raise exception 'Document ownership and storage paths cannot be reassigned' using errcode='42501';
    end if;
    if public.current_role()='user' and (TG_OP='INSERT' and new.status<>'Pending Review' or TG_OP='UPDATE' and new.status is distinct from old.status) then
      raise exception 'Only staff can review documents' using errcode='42501';
    end if;
  end if;
  if new.file_size<0 or new.file_size>8388608 then raise exception 'Documents must be at most 8 MB'; end if;
  return new;
end; $$;
drop trigger if exists kagie_audit_document_guard on public.documents;
create trigger kagie_audit_document_guard before insert or update on public.documents
for each row execute function kagie_private.guard_document_fields();

-- Existing UI uses two explicit system-note namespaces for learner-visible details.
-- Ordinary application notes remain staff-only; do not trust client filtering.
drop policy if exists kagie_audit_note_boundary on public.application_notes;
create policy kagie_audit_note_boundary on public.application_notes as restrictive for all to authenticated
using(kagie_private.can_access_application(application_id) and (public.is_staff() or
  left(note,25)='__KAGIE_LEARNER_SUPPORT__' or left(note,23)='__KAGIE_PORTAL_ACCESS__'))
with check(kagie_private.can_access_application(application_id) and author_id=auth.uid() and author_role=public.current_role() and
  (public.is_staff() or left(note,25)='__KAGIE_LEARNER_SUPPORT__'));
drop policy if exists kagie_audit_review_boundary on public.document_reviews;
create policy kagie_audit_review_boundary on public.document_reviews as restrictive for all to authenticated
using(public.is_staff() and exists(select 1 from public.documents d where d.id=document_id and kagie_private.can_access_user(d.user_id)))
with check(public.is_staff() and assistant_id=auth.uid() and exists(select 1 from public.documents d where d.id=document_id and kagie_private.can_access_user(d.user_id)));
drop policy if exists kagie_audit_message_boundary on public.support_messages;
create policy kagie_audit_message_boundary on public.support_messages as restrictive for all to authenticated
using((not is_internal or public.is_staff()) and exists(select 1 from public.support_threads t where t.id=thread_id and kagie_private.can_access_user(t.user_id)))
with check(sender_id=auth.uid() and sender_role=public.current_role() and (not is_internal or public.is_staff()) and
  exists(select 1 from public.support_threads t where t.id=thread_id and kagie_private.can_access_user(t.user_id)));
drop policy if exists kagie_audit_message_update on public.support_messages;
create policy kagie_audit_message_update on public.support_messages as restrictive for update to authenticated
using(sender_id=auth.uid() or public.current_role()='master_admin')
with check(sender_id=auth.uid() or public.current_role()='master_admin');
drop policy if exists kagie_audit_message_delete on public.support_messages;
create policy kagie_audit_message_delete on public.support_messages as restrictive for delete to authenticated
using(sender_id=auth.uid() or public.current_role()='master_admin');

-- Private learner objects: ownership is the UUID path, never bucket membership alone.
-- Public learning-resource namespaces remain readable by signed-in learners.
create or replace function kagie_private.can_read_file(path_arg text)
returns boolean language sql stable security definer set search_path = '' as $$
  select kagie_private.account_active() and (public.current_role()='master_admin' or
    split_part(path_arg,'/',1)=auth.uid()::text or
    path_arg ~ '^prospectus/[A-Za-z0-9_-]+/[^/]+\.pdf$' or
    path_arg='past-papers/catalog.json' or path_arg ~ '^past-papers/[^/]+\.pdf$' or
    exists(select 1 from public.documents d where d.file_url=path_arg and d.user_id::text=split_part(path_arg,'/',1) and kagie_private.staff_can_access_user(d.user_id)) or
    exists(select 1 from public.question_papers q where (q.remote_path=path_arg or q.file_url=path_arg) and lower(q.status)='published'));
$$;
create or replace function kagie_private.can_write_file(path_arg text)
returns boolean language sql stable security definer set search_path = '' as $$
  select kagie_private.account_active() and path_arg !~ '(^|/)\.\.(/|$)' and
    (public.current_role()='master_admin' or split_part(path_arg,'/',1)=auth.uid()::text or
      public.current_role()='assistant_admin' and
      case when split_part(path_arg,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        kagie_private.staff_can_access_user(split_part(path_arg,'/',1)::uuid) else false end);
$$;
drop policy if exists kagie_audit_file_read on storage.objects;
create policy kagie_audit_file_read on storage.objects as restrictive for select to authenticated
using(bucket_id<>'kagie-documents' or kagie_private.can_read_file(name));
drop policy if exists kagie_audit_file_insert on storage.objects;
create policy kagie_audit_file_insert on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'kagie-documents' or kagie_private.can_write_file(name));
drop policy if exists kagie_audit_file_update on storage.objects;
create policy kagie_audit_file_update on storage.objects as restrictive for update to authenticated
using(bucket_id<>'kagie-documents' or kagie_private.can_write_file(name))
with check(bucket_id<>'kagie-documents' or kagie_private.can_write_file(name));
-- New delete is limited to a user's own private uploads (needed for failed insert cleanup).
drop policy if exists kagie_audit_file_delete on storage.objects;
create policy kagie_audit_file_delete on storage.objects for delete to authenticated
using(bucket_id='kagie-documents' and kagie_private.can_write_file(name));

revoke all on all functions in schema kagie_private from public;
grant execute on function kagie_private.account_active(),kagie_private.staff_can_access_user(uuid),
  kagie_private.can_access_user(uuid),kagie_private.can_access_application(uuid),
  kagie_private.can_read_file(text),kagie_private.can_write_file(text) to authenticated;
-- RLS does not govern TRUNCATE. These legacy blanket privileges are unnecessary.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
commit;
