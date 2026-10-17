alter table public.application_packs add column if not exists application_type text not null default 'UNDERGRADUATE';
alter table public.applications add column if not exists application_type text not null default 'UNDERGRADUATE';

alter table public.applications drop constraint if exists applications_status_check;

alter table public.applications add constraint applications_status_check check (
  status in (
    'Draft',
    'Package Selected',
    'Awaiting Payment',
    'Paid',
    'Pending Details',
    'Incomplete',
    'Submitted',
    'Under Review',
    'Documents Required',
    'Documents Missing',
    'Missing Documents',
    'Awaiting Institution Fee',
    'Submitted to Institution',
    'Ready to Apply',
    'Applied',
    'Pending Feedback',
    'Accepted',
    'Rejected',
    'Cancelled',
    'Application being processed'
  )
);
