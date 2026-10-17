-- Archived from production migration history on 2026-10-15. Already applied there.
-- This file reconciles local history; do not reapply it manually to production.
-- Manual account repair belongs to trusted server/SQL administration.
do $$
begin
  if to_regprocedure('public.kagie_upsert_auth_staff(text,text,text,text,text)') is not null then
    revoke execute on function public.kagie_upsert_auth_staff(text,text,text,text,text) from public, anon, authenticated;
    grant execute on function public.kagie_upsert_auth_staff(text,text,text,text,text) to service_role;
  end if;
end;
$$;
