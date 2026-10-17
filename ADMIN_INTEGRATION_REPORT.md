# Kagie admin integration report

Status: implemented and verified locally on 5 October 2026. The release is prepared in `web-release`. The new migrations have **not** been applied to the live Supabase project, and no production deployment or authenticated production write was performed.

## Connected implementation

| Area | Implementation and source of truth |
| --- | --- |
| Staff identity | Actual Supabase `auth.getUser()` and `profiles.role`; privileged server authorization ignores editable user metadata and email allowlists |
| Navigation | Dedicated Master and Assistant views, role-specific actions, URL search/filter/page/ticket state, mobile navigation |
| Applications | One shared `js/staff-application-workspace.js`; distinct learner/application records; original structured form payloads and academic/institution fields remain readable |
| Assignment | Confirmed database update of application or CV assignment; database guard checks form compatibility and staff role |
| Access controls | Form permissions and 22 service/action keys, edited by Master Admin; RLS, field guards and private storage policies enforce the boundary |
| Documents | Private preview/download, atomic review status/history/notification RPC, useful rejection reason, repeatable review history |
| Payments | Master-only atomic staff decision/history RPC; provider transactions remain a separate read-only state system |
| Support | Existing threads/messages, persistent replies, selected conversation URL state; internal messages remain staff-only |
| Callbacks/updates/notes | Existing database tables; independent callback state, learner updates and private staff notes |
| Portal details | Atomic payload and history write; add/edit/remove current entries; masked reveal/copy; no credential payloads in generated audit records |
| Housing | Listings, review, availability, provider contacts and learner requests; deposit, rooms, amenities, dates and assistant assignment persisted |
| CV Revamp | New persistent requests and versions, assigned learner workspace, career goal/note/missing information, human messages, editing, live preview and final file delivery |
| CV export | Reuses the existing CV Builder HTML preview and actual DOCX generator; files saved in private storage and linked to the learner's Documents page |
| Opportunities | Existing job/internship registry, separate approval and publication states, private drafts/submission/Master approval/direct-publication grant, expiry filtering and unpublish/archive |
| Images | Decoded JPG/JPEG/PNG/WEBP validation, 8 MB limit, picker/drop preview, remove/replace, stored path, signed image on learner cards, failed-upload retry |
| Content | Existing institution, career article/resource, question-paper, announcement and service-content records; real files and writes |
| Health/audit | Actual table reads plus a deployed-capability RPC; role-aware activity; no invented uptime/payment-provider claim |

Production admin writes do not use fixture data, base64-only image storage, local-only approvals or a simulated save. Fixture identities, the HTTP protocol adapter and test files exist only in `scripts/admin-test-server.cjs` and the isolated QA runtime; they are excluded from the release.

## Database changes

`supabase/20261004_staff_service_drafts.sql` introduces service permissions and assistant content drafts. `supabase/20261004_admin_workflows_and_security.sql` adds CV requests/versions, action permissions, approval/expiry fields, housing fields, payment review history, atomic staff RPCs, audit triggers and restrictive access rules.

The workflow migration is transactional and can be reapplied. It preserves existing source documents, assignments, processing states and historical records. Existing CV source files become unassigned requests; Master Admin can assign them and atomically link a historical request to a new conversation. New learner CV uploads automatically create a persistent request and conversation, including the draft, career goal and learner note.

Storage rules distinguish learner UUID folders from published content. Assistants cannot sign unrelated CV sources or overwrite existing learner documents. Submitted/published opportunity images cannot be changed through storage without the corresponding publication permission. Existing public prospectus and past-paper namespaces retain read access; learner document paths remain private. Existing `kagie-documents` must be private, as defined in the base schema and confirmed by System Health.

## Preserved learner behavior

The public landing page, application registry, package selection, checkout/provider handlers, existing application payloads and learner document center remain in place. The relevant learner changes are real job-card images, error-visible opportunity loading, truthful empty CV defaults, persistent CV requests and revised-CV downloads. Staff review does not mark an application completed, admit a learner, or change the payment provider outcome.

Existing account and payment APIs are retained. Staff account creation continues through the protected server endpoint and requires real server-side credentials; its UI only reports success after a live directory confirmation.

## Capabilities that remain unavailable or require another backend feature

- Arbitrary role changes, suspension and account deletion do not have a supported API in the inspected admin service; the directory displays actual roles.
- Provider/landlord accounts have no account CRUD model. Provider contacts derive from real housing listings.
- The opportunity registry supports `job` and `internship`. Learnership, bursary, apprenticeship and other categories require an agreed registry/schema change before becoming separate types.
- Automated archive scheduling has no worker. Expired opportunities are filtered by the database; staff can archive/unpublish manually.
- Hosted PDF generation is absent. DOCX export is real and persistent; the existing print action remains browser print.
- Per-message unread counters, permanent content deletion and automatic orphan-file cleanup are not exposed without suitable backend support. Old CV versions and replaced assets are retained.
- Refunds, reversals and new payment charges are not implemented by staff review. The existing provider flow remains separate.
- Live Supabase migration, real Auth sign-in/sign-out, secure assistant creation, deployed server functions and payment-provider verification need a configured test environment and designated accounts. Local admin/database credentials currently contain placeholders.

See `ADMIN_UI_SETUP.md` for activation, `ADMIN_ROUTES_AND_PERMISSIONS.md` for access details, and `ADMIN_TESTING_REPORT.md` for the exact verification scope.
