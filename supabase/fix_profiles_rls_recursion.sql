create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    'user'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.current_role() in ('assistant_admin', 'master_admin');
$$;

grant execute on function public.current_role() to anon, authenticated, service_role;
grant execute on function public.is_staff() to anon, authenticated, service_role;
