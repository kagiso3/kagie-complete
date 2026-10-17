# Kagie admin UI

The supplied designs now run at `/assistant/dashboard.html` and `/master-admin/dashboard.html`. The root `/assistant-admin.html` and `/master-admin.html` URLs redirect to those protected routes.

## Required database setup

Apply the two reviewed admin migrations in this order using the Supabase SQL editor or a database migration connection:

1. `supabase/20261004_staff_service_drafts.sql`
2. `supabase/20261004_admin_workflows_and_security.sql`

The existing project must already contain the base schema and the assignment/profile/question-paper, accommodation/transport, content-control, management-center, scope-hardening and specialized-application migrations. In particular, the workflow depends on `20260606_specialised_application_packages.sql`, `20260815_admin_permissions_updates_support.sql` and `20260815_career_hub_opportunities.sql`. Review applied migrations before running any older file; do not overwrite a populated project with a fresh schema.

The migrations add action permissions, persistent CV requests/versions, job approval and expiry fields, housing details and assignment, atomic reviews/portal history, authoritative role guards, audit triggers and restrictive private-file policies. Existing ordinary assigned work retains backward-compatible defaults. Institution management, direct publication and unpublish actions require explicit grants. Every action grant also requires its parent service. If permission records cannot load, the affected assistant workspace stays locked.

Both files are included in this checkout and tested locally; neither is claimed as applied to the live database. Local admin/database credentials contain placeholders. No production data was manually changed.

## Workflows

- Applications open a shared tabbed record workspace, preserving complete specialized form payloads, academic information, institution selections, portal details, notes, payment history and processing status.
- Master Admin assigns applications, creates assistants through the existing protected server endpoint, manages form and service permissions, and verifies payments.
- Document reviews record a decision and comments. Rejecting a document requires a reason.
- CV review uses persistent assigned requests created from learner uploads. Staff can edit structured information with a live preview, message the learner, save versions, reuse the existing DOCX generator or upload a final PDF/DOC/DOCX, and deliver it to the learner's Documents area.
- Support replies and status changes persist in the existing ticket tables. Callback progress and housing request notes persist in their existing records.
- Assistants submit their own job drafts for approval and prepare housing drafts. Master Admin reviews and publishes them. Explicit action grants govern direct publication, availability, CV review/completion and job unpublish. Jobs retain real image storage paths and show signed images to learners.
- Content management edits institutions, career articles and resource attachments, question papers, announcements, and Career Hub / Housing service availability. Archive and inactive states preserve existing records.

Authentication checks the Supabase session and the profile's actual staff role. New reads and writes use Supabase directly, with database errors surfaced to the UI. Payment/document reviews and portal history are atomic RPCs; application assignment is a confirmed database write protected by a form-compatibility guard. There is no prototype data or local success fallback in these dashboards.

## Build and preview

Run `npm run build:release` to rebuild the distributable website. The `web-release` directory includes both dashboards, shared CSS/JavaScript, and aliases. Database migrations belong in the database, not in the public release.

Run `npm run preview:landing` to preview the pages at `http://127.0.0.1:3010`. Sign in with a real staff account. This static preview does not host the protected server functions used for assistant creation and some existing account operations; validate those on the configured deployment.

Local verification passed 59 actual PostgreSQL/RLS checks and 42 browser integration checks. These use synthetic identities and an isolated HTTP adapter with the real production frontend and Supabase SDK. Live authenticated writes, hosted Auth, Storage service behavior and deployed server functions still require verification after migration.

## Activation and live verification

Use a designated Supabase test environment and real Master/Assistant/learner accounts first. Keep the service-role key on the server; never put it in browser configuration. The `kagie-documents` bucket must remain private. Open System Health after migration to confirm database reads, the private bucket and all three restrictive file policies.

Run the full Master/Assistant workflow from the request: eligible application assignment, form/service revocation, document/payment review, CV assignment/editing/delivery, housing edits, both job image input methods, approval and learner visibility, support replies and a fresh sign-in/device. Check denied direct IDs and storage requests, then test the existing learner package, payment-provider test flow and uploads. Account creation needs the configured protected server endpoint; static preview alone does not provide it.

The prepared `web-release` contains the current admin pages and the existing landing export, with updated asset/cache versions. It is ready for review, not evidence of production deployment. See `ADMIN_ROUTES_AND_PERMISSIONS.md`, `ADMIN_INTEGRATION_REPORT.md` and `ADMIN_TESTING_REPORT.md` for routes, security boundaries, missing capabilities and exact test scope.
