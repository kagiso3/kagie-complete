-- LOCAL REVIEW MIGRATION. Actual live catalog uses is_visible/application_status.
-- Apply after the audit hardening migration; no private learner data is exposed.
begin;
-- Preserve the API's year, short name, and faculty fields without inventing
-- alternative visibility/status columns alongside the actual live schema.
alter table public.institutions add column if not exists catalog_metadata jsonb not null default '{}';
alter table public.institutions enable row level security;
alter table public.question_papers enable row level security;
grant select on public.institutions,public.question_papers to anon,authenticated;
grant insert,update,delete on public.institutions,public.question_papers to authenticated;
drop policy if exists kagie_audit_institution_read on public.institutions;
create policy kagie_audit_institution_read on public.institutions for select to anon,authenticated
using(coalesce(is_visible,true));
drop policy if exists kagie_audit_institution_master on public.institutions;
create policy kagie_audit_institution_master on public.institutions for all to authenticated
using(kagie_private.account_active() and public.current_role()='master_admin')
with check(kagie_private.account_active() and public.current_role()='master_admin');
drop policy if exists kagie_audit_question_paper_read on public.question_papers;
create policy kagie_audit_question_paper_read on public.question_papers for select to anon,authenticated
using(lower(coalesce(status,''))='published');
drop policy if exists kagie_audit_question_paper_master on public.question_papers;
create policy kagie_audit_question_paper_master on public.question_papers for all to authenticated
using(kagie_private.account_active() and public.current_role()='master_admin')
with check(kagie_private.account_active() and public.current_role()='master_admin');
commit;
