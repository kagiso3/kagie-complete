# Kagie admin implementation map

Audit date: 4 October 2026. This work extends the existing HTML/JavaScript admin pages; the Next.js public landing page and learner checkout remain intact.

## Existing system

| Area | Existing source of truth |
| --- | --- |
| Identity | Supabase Auth and `profiles.role`: `user`, `assistant_admin`, `master_admin` |
| Application access | `applications.assistant_id`, legacy learner `assignments`, `assistant_form_permissions`, five `application_form_types` |
| Application data | `applications.application_payload`, profile/guardian/school tables, marks, application packs and institution selections |
| Payments | `applications.payment_status/payment_info`, `payments`; provider outcome is separate from staff verification |
| Documents | `documents`, `document_reviews`, private `kagie-documents` storage |
| Support | `support_threads`, `support_messages`, `callback_requests` |
| Progress | Learner-visible `application_updates` and `notifications`; staff-only `application_notes`; `assistant_activity` |
| Housing | `housing_listings`, `accommodation_requests` |
| Career | `career_articles`: article/resource/job/internship; existing learner Career Hub and CV Builder |
| Content | `institutions`, `question_papers`, `announcements`, `admin_content` |
| Secure server operations | `server/functions/admin-users.js`, `admin-assistants.js`, `auth-role.js`, corresponding `api/` adapters |

`js/backend.js` contains live methods and legacy local fallbacks. Admin screens must verify live identity and read/write directly through `js/staff-admin-api.js`, or confirm existing server operations against a live read. A local cached save is insufficient evidence of success.

Existing canonical routes: `/master-admin/dashboard.html?page=...`, `/assistant/dashboard.html?page=...`, `/master-admin/application-view.html?id=...`, `/assistant/applicant-view.html?id=...`. Search, filters, pagination, workspace tabs and selected conversations will use URL parameters.

Existing statuses remain separate: application processing values; payment `Pending Verification/Verified/Rejected`; document `Pending Review/Approved/Rejected`; support `open/in_progress/awaiting_user/resolved/closed`; callback `Pending/Contacted/Resolved`; career/housing `draft/published/archived`.

## Required extensions

1. Database: authoritative profile roles, protected role/assignment/payment fields, form-aware record access, private storage access, staff-only notes and internal support messages. Expand service grants with explicit action grants.
2. CV: persistent requests, assignments, structured draft and version history, human conversation, final file delivery. Reuse existing CV Builder HTML preview and DOCX generator; browser print remains a print action, never a claimed generated PDF.
3. Jobs: separate draft/submission states without changing the existing publication status; persistent image paths, picker/drop validation, remove/replace, expiry and unpublish.
4. UI: shared application workspace; dedicated content routes; housing subviews; URL state and retryable errors. Retain all specialized application fields.
5. Verification: execute actual SQL and role policies in local Postgres, exercise browser workflows and failures, package release and record results. Live Supabase verification additionally requires a configured test environment and test accounts.

## Implementation stages

Apply and test security/backend extensions first, then shared navigation/application workspace, then CV and housing services, then job image/approval integration. Run focused checks after each stage and document remaining live-environment requirements. Migration files are reviewable changes, not evidence of deployed policies. No production data will be manually edited.
