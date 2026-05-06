-- Kagie institution catalog hardening.
-- Run this once in Supabase SQL editor before staff start managing live institutions.

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null default '',
  province text not null default '',
  type text not null default '',
  logo text not null default '',
  year text not null default extract(year from timezone('utc', now()))::text,
  application_fee numeric(10,2) not null default 0,
  application_fee_label text not null default '',
  application_fee_note text not null default '',
  opening_date date,
  closing_date date,
  manual_status text not null default '' check (manual_status in ('', 'open', 'closing_soon', 'closed')),
  is_active boolean not null default true,
  faculties jsonb not null default '[]'::jsonb,
  course_entry_mode text not null default 'manual' check (course_entry_mode in ('manual', 'guided')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

with duplicate_institutions as (
  select
    id,
    row_number() over (
      partition by lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
      order by is_active desc, updated_at desc, created_at desc, id
    ) as rn
  from public.institutions
)
delete from public.institutions i
using duplicate_institutions d
where i.id = d.id and d.rn > 1;

drop index if exists public.institutions_unique_name_type_idx;
create unique index if not exists institutions_unique_name_idx
  on public.institutions (
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
  );

drop trigger if exists set_institutions_updated_at on public.institutions;
create trigger set_institutions_updated_at
before update on public.institutions
for each row
execute procedure public.set_updated_at();

alter table public.institutions enable row level security;

drop policy if exists "institutions_public_read" on public.institutions;
create policy "institutions_public_read" on public.institutions
for select using (true);

drop policy if exists "institutions_master_write" on public.institutions;
create policy "institutions_master_write" on public.institutions
for all
using (public.current_role() = 'master_admin')
with check (public.current_role() = 'master_admin');
