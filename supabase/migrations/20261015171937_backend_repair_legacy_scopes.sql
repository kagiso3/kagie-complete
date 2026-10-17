-- LOCAL ONLY; never apply without the approved release procedure.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
-- Additive scope and preservation rules for existing production tables.
alter table public.accommodation_requests add column if not exists assigned_assistant_id uuid references public.profiles(id);
do $$ declare t text; begin
 foreach t in array array['learner_details','parent_details','school_details','marks'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists repair_legacy_owner on public.%I',t);
  execute format('create policy repair_legacy_owner on public.%I for all to authenticated using(kagie_private.can_access_user(user_id)) with check(kagie_private.can_access_user(user_id))',t);
  execute format('drop trigger if exists repair_legacy_owner on public.%I',t);
  execute format('create trigger repair_legacy_owner before insert or update on public.%I for each row execute function kagie_private.guard_owned_fields()',t);
 end loop;
 foreach t in array array['accommodation_requests','transport_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists repair_request_scope on public.%I',t);
  execute format('create policy repair_request_scope on public.%I for all to authenticated using(kagie_private.account_active() and (user_id=auth.uid() or public.current_role()=''master_admin'' or public.current_role()=''assistant_admin'' and public.assistant_has_service_access(auth.uid(),''accommodation'') and (assigned_assistant_id=auth.uid() or application_id is not null and public.can_access_application(application_id)))) with check(kagie_private.account_active() and (user_id=auth.uid() or public.current_role()=''master_admin'' or public.current_role()=''assistant_admin'' and public.assistant_has_service_access(auth.uid(),''accommodation'') and (assigned_assistant_id=auth.uid() or application_id is not null and public.can_access_application(application_id))))',t);
 end loop;
end; $$;
create or replace function kagie_private.guard_service_request() returns trigger language plpgsql security definer set search_path='' as $$
declare n jsonb:=to_jsonb(new);o jsonb:=case when TG_OP='UPDATE' then to_jsonb(old) else '{}' end;
begin
 if new.application_id is not null and not exists(select 1 from public.applications a where a.id=new.application_id and a.user_id=new.user_id) then raise exception 'Request owner must match application' using errcode='42501'; end if;
 if auth.uid() is not null and public.current_role()<>'master_admin' then
  if TG_OP='INSERT' and new.user_id<>auth.uid() and public.current_role()<>'assistant_admin' or
   TG_OP='UPDATE' and (new.user_id is distinct from old.user_id or new.application_id is distinct from old.application_id) or
   TG_OP='INSERT' and new.assigned_assistant_id is not null or TG_OP='UPDATE' and new.assigned_assistant_id is distinct from old.assigned_assistant_id then raise exception 'Request ownership and assignment are restricted' using errcode='42501'; end if;
  if TG_TABLE_NAME='transport_requests' and public.current_role()='user' and (
   coalesce(n->>'paid_at','')<>'' or coalesce((n->>'payment_amount')::numeric,0)<>0 or
   coalesce(n->>'booked_by_user_id','')<>'' or coalesce(n->>'ticket_code','')<>'' or coalesce(n->>'sent_at','')<>'') then raise exception 'Confirmed bookings are managed by staff' using errcode='42501'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists repair_request_guard on public.accommodation_requests;
create trigger repair_request_guard before insert or update on public.accommodation_requests for each row execute function kagie_private.guard_service_request();
drop trigger if exists repair_request_guard on public.transport_requests;
create trigger repair_request_guard before insert or update on public.transport_requests for each row execute function kagie_private.guard_service_request();
drop policy if exists repair_course_read on public.courses;
create policy repair_course_read on public.courses for select to anon,authenticated using(is_visible and exists(select 1 from public.institutions i where i.id=institution_id and i.is_visible));
drop policy if exists repair_course_master on public.courses;
create policy repair_course_master on public.courses for all to authenticated using(public.current_role()='master_admin') with check(public.current_role()='master_admin');
drop policy if exists repair_admin_notes on public.admin_notes;
create policy repair_admin_notes on public.admin_notes for all to authenticated using(public.is_staff() and public.can_access_user(user_id)) with check(public.is_staff() and public.can_access_user(user_id) and admin_id=auth.uid());
drop policy if exists repair_activity_read on public.activity_logs;
create policy repair_activity_read on public.activity_logs for select to authenticated using(public.current_role()='master_admin' or public.current_role()='assistant_admin' and admin_id=auth.uid());
drop policy if exists repair_activity_write on public.activity_logs;
create policy repair_activity_write on public.activity_logs for insert to authenticated with check(public.is_staff() and admin_id=auth.uid() and (user_id is null or public.can_access_user(user_id)));

-- Reject new duplicate catalog names without deleting any historical record.
create or replace function kagie_private.guard_institution_name() returns trigger language plpgsql security definer set search_path='' as $$
declare key_arg text:=lower(regexp_replace(btrim(new.name),'\s+',' ','g'));
begin
 if TG_OP='UPDATE' and new.name is not distinct from old.name then return new; end if;
 if key_arg='' then raise exception 'Institution name is required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(key_arg,1));
 if exists(select 1 from public.institutions i where i.id<>new.id and lower(regexp_replace(btrim(i.name),'\s+',' ','g'))=key_arg) then raise exception 'An institution with this name already exists' using errcode='23505'; end if;
 return new;
end; $$;
drop trigger if exists repair_institution_name on public.institutions;
create trigger repair_institution_name before insert or update of name on public.institutions for each row execute function kagie_private.guard_institution_name();
-- These legacy functions must never be a public configuration-reset API.
revoke all on function public.seed_default_packs() from public,anon,authenticated;
alter function public.seed_default_packs() set search_path='public';
alter function public.set_updated_at() set search_path='';

-- Public promotion details omit redemption identities and inactive campaigns.
create or replace view public.promo_catalog with (security_barrier=true) as
 select id,code,title,description,discount_kind,discount_value,offer_note,max_uses,used_count,is_active,share_path,created_at,updated_at from public.promo_campaigns
 where is_active and kagie_private.account_active();
revoke all on public.promo_catalog from public,anon,authenticated;
grant select on public.promo_catalog to authenticated;
revoke all on all functions in schema kagie_private from public;
revoke truncate,references,trigger on all tables in schema public from anon,authenticated;

create or replace function kagie_private.guard_application_financial_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare n jsonb:=to_jsonb(new);o jsonb:=case when TG_OP='UPDATE' then to_jsonb(old) else '{}' end;
begin
 if auth.uid() is null or public.current_role()='master_admin' then return new; end if;
 if public.current_role()='assistant_admin' and TG_OP='UPDATE' and
  (n->'payment_amount' is distinct from o->'payment_amount' or n->'payment_method' is distinct from o->'payment_method' or
   n->'payment_reference' is distinct from o->'payment_reference' or n->'payment_note' is distinct from o->'payment_note' or
   n->'package_id' is distinct from o->'package_id' or n->'selected_package_id' is distinct from o->'selected_package_id' or
   n->'package_price' is distinct from o->'package_price' or n->'final_total' is distinct from o->'final_total' or n->'addons_total' is distinct from o->'addons_total') then raise exception 'Payment facts and selected pricing are managed by the trusted payment service or master' using errcode='42501'; end if;
 if TG_OP='UPDATE' and old.payment_status in ('Verified','Paid','Refunded') and
  (new.application_type is distinct from old.application_type or new.selected_package_id is distinct from old.selected_package_id or
   new.selected_addons is distinct from old.selected_addons or new.package_price is distinct from old.package_price or
   new.addons_total is distinct from old.addons_total or new.final_total is distinct from old.final_total) then raise exception 'A settled order cannot change its purchased application type or pricing' using errcode='42501'; end if;
 return new;
end; $$;
drop trigger if exists repair_financial_identity on public.applications;
create trigger repair_financial_identity before insert or update on public.applications for each row execute function kagie_private.guard_application_financial_identity();

alter table public.support_threads drop constraint if exists support_threads_status_check;
alter table public.support_threads add constraint support_threads_status_check check(status in ('open','in_progress','awaiting_user','resolved','closed'));

create or replace function public.record_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.application_status_history (
      application_id,
      old_status,
      new_status,
      changed_by
    ) values (
      new.id,
      coalesce(old.status, ''),
      new.status,
      auth.uid()
    );
  end if;
  return new;
end;
$$;
drop trigger if exists record_application_status_change on public.applications;
create trigger record_application_status_change after update of status on public.applications for each row execute function public.record_application_status_change();
revoke all on function public.record_application_status_change() from public,anon,authenticated;
commit;
notify pgrst,'reload schema';
