-- Speeds up the staff dashboards, user detail lookups, and application review flows
-- that now load complete learner/application detail sets for production.

create index if not exists idx_profiles_role_created_at
on public.profiles (role, created_at desc);

create index if not exists idx_profiles_email_lower
on public.profiles (lower(email));

create index if not exists idx_profiles_user_id
on public.profiles (user_id);

create index if not exists idx_user_profiles_user_id
on public.user_profiles (user_id);

create index if not exists idx_guardian_profiles_user_id
on public.guardian_profiles (user_id);

create index if not exists idx_school_profiles_user_id
on public.school_profiles (user_id);

create index if not exists idx_applications_user_status_updated
on public.applications (user_id, status, updated_at desc);

create index if not exists idx_applications_assistant_updated
on public.applications (assistant_id, updated_at desc);

create index if not exists idx_applications_payment_status
on public.applications (payment_status, updated_at desc);

create index if not exists idx_application_marks_application_id
on public.application_marks (application_id);

create index if not exists idx_application_institutions_application_id
on public.application_institutions (application_id);

create index if not exists idx_payments_application_created
on public.payments (application_id, created_at desc);

create index if not exists idx_payments_status_created
on public.payments (status, created_at desc);

create index if not exists idx_documents_user_status
on public.documents (user_id, status, created_at desc);

create index if not exists idx_documents_application_id
on public.documents (application_id);

create index if not exists idx_support_threads_user_updated
on public.support_threads (user_id, updated_at desc);

create index if not exists idx_support_messages_thread_created
on public.support_messages (thread_id, created_at desc);

create index if not exists idx_callback_requests_user_status
on public.callback_requests (user_id, status, updated_at desc);

create index if not exists idx_callback_requests_assistant_status
on public.callback_requests (assigned_assistant_id, status, updated_at desc);

create index if not exists idx_assistant_activity_assistant_created
on public.assistant_activity (assistant_id, created_at desc);

create index if not exists idx_activity_logs_admin_timestamp
on public.activity_logs (admin_id, timestamp desc);

create index if not exists idx_accommodation_requests_user_updated
on public.accommodation_requests (user_id, updated_at desc);

create index if not exists idx_transport_requests_user_updated
on public.transport_requests (user_id, updated_at desc);
