-- Career Hub opportunities extension.
-- Safe to run more than once in Supabase SQL editor.

alter table public.career_articles
  add column if not exists content_type text not null default 'article',
  add column if not exists company text not null default '',
  add column if not exists location text not null default '',
  add column if not exists work_mode text not null default '',
  add column if not exists employment_type text not null default '',
  add column if not exists category text not null default '',
  add column if not exists level text not null default '',
  add column if not exists closing_date text not null default '',
  add column if not exists start_date text not null default '',
  add column if not exists duration text not null default '',
  add column if not exists application_url text not null default '',
  add column if not exists tags text[] not null default '{}',
  add column if not exists requirements text[] not null default '{}';

alter table public.career_articles
  drop constraint if exists career_articles_content_type_check;

alter table public.career_articles
  add constraint career_articles_content_type_check
  check (content_type in ('article', 'resource', 'job', 'internship'));

create index if not exists idx_career_articles_type_status_updated
  on public.career_articles(content_type, status, updated_at desc);

