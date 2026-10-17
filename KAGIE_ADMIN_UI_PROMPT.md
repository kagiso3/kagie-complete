# Kagie Assistant Admin and Master Admin redesign prompt

Copy the prompt below into your website/code generator. It describes the existing product and a proposed interface redesign. Check the repository and available backend operations before implementing it.

```text
Redesign Kagie's Assistant Admin and Master Admin interfaces into a complete, connected, easy-to-navigate administration experience. Preserve the existing application, learner, payment, document, support, assignment, and content workflows. Build functional interfaces around the real backend.

1. UNDERSTAND THE PRODUCT AND ROLES

Kagie is a South African tertiary application assistance platform. Learners create a profile, supply personal and academic details, choose institutions and courses, select an application package, pay, upload documents, and receive assistance and progress updates. A learner can have multiple applications, and an application can contain multiple institution and course choices. Keep learner records, application records, and institution choices distinct.

Assistant Admin is the operational workspace for processing assigned learners and applications. Assistants review details and documents, record progress, maintain institution portal details, add internal notes, reply to support conversations, handle callback requests, and publish appropriate learner-visible application updates. Payment information is read-only for assistants. Assistants cannot assign learners, verify or reject payments, create staff accounts, grant permissions, or manage platform content unless an existing backend permission explicitly authorizes an action.

Master Admin manages the operation across the platform: all applications and learners, assistant assignments, assistant accounts and form access, payment reviews, document reviews, support, and content management. Master Admin records verified institution outcomes; universities and funding providers make their own admission and funding decisions.

The existing roles are user, assistant_admin, and master_admin. Assistant access depends on assignment and permitted application form types. Supported application types include undergraduate, bridging, transfer, postgraduate, and late applications. Inspect the actual registry and preserve all specialized form data.

2. VISUAL DIRECTION

Use Kagie's primary red exactly: #e30000. Use it for primary buttons, selected navigation, links, focus indicators, and restrained brand accents. Where a gradient is useful, use a linear gradient based on this red, such as linear-gradient(135deg, #e30000 0%, #b80000 100%).

Use white surfaces, a soft grey background, dark readable text, subtle borders, consistent spacing, and Lucide icons. The visual treatment should suit a professional daily work tool. Keep colour and decoration restrained so tables, documents, and next actions are easy to scan. Reserve green, amber, and other semantic colours for clearly labelled statuses. Never communicate a status through colour alone.

Build a shared component system for both roles: navigation, buttons, tables, filters, tabs, forms, status badges, detail headers, timelines, file previews, notices, and confirmation dialogs. Ensure readable text, clear keyboard focus, accessible labels, and reduced-motion support.

3. SHARED NAVIGATION AND LAYOUT

Use a persistent desktop sidebar, compact top bar, breadcrumbs, page title, and a visible role indicator. Put notifications and account controls in the top bar. Group navigation by work area and clearly mark the active page.

Every main menu item must open a real page or clearly distinct view with an addressable URL. Replace the current pattern where several menu items scroll to the same section of a long dashboard. Use query parameters for filters, search, tabs, and pagination so refresh and browser Back preserve context. Application detail pages must be directly linkable and return to the previous queue position.

Use dedicated pages for large forms and content editors. Use dialogs or drawers for short contextual tasks such as assignment, a status update, or a review reason. Keep notifications, support conversations, staff-only notes, and announcements visibly distinct.

On tablets, collapse navigation gracefully. On phones, use a navigation drawer, readable record cards or contained table scrolling, and accessible primary actions. Prevent the whole page from overflowing horizontally. Keep admin tasks inside the admin shell; offer an explicitly labelled learner-view preview where useful.

4. ASSISTANT ADMIN EXPERIENCE

Organize the assistant workspace into:
- Dashboard.
- My Applications.
- My Learners.
- Document Review.
- Support Inbox.
- Callback Requests.
- Announcements.
- My Activity.
- My Account and Settings.

Provide read-only institution and course reference views only where supported. My Learners is a directory with one row per learner; My Applications is a work queue with one row per application. They must serve different purposes.

The Dashboard should answer: What needs my attention today? Show real scoped counts for assigned applications, document reviews, applications needing learner information, and open support work. Display priority tasks and recent activity with links to the exact record. Make metric cards open the matching filtered queue. Use real deadlines where available; do not invent urgency, overdue flags, or performance numbers.

My Applications needs search by learner name, application reference, and permitted contact fields; filters for application type, processing status, document state, and institution where the data supports them; sensible sorting; pagination; and clear empty states. Include learner name, application reference, type, institution choices, processing status, document readiness, last update, and an Open application action. Use All, In Progress, and Completed as queue views rather than duplicate navigation items. Define these categories using the existing backend status mappings.

Document Review should show pending, approved, and rejected documents. Provide a PDF/image preview where supported, learner and application context, document category, upload time, review history, and review actions. Require a useful reason for rejection, preserve existing review status values, and make it easy to open the associated application.

Support Inbox should provide searchable conversations, status filters, unread indicators where supported, conversation history, replies, and related learner/application links. Callback Requests should expose existing Pending, Contacted, and Resolved states. Show the next action clearly, and persist replies and callback changes through the real APIs.

5. MASTER ADMIN EXPERIENCE

Group master navigation into:
- Operations: Overview, Applications, Learners, Assistants and Access, Payment Review, Document Review, Support Inbox, and Callback Requests where supported.
- Content: Institutions, Career Hub, Housing, Question Papers, and Announcements.
- Administration: Users and Roles, Activity and Audit, System Health, and My Account.

The Overview should show live operational counts and actionable queues: unassigned applications, pending payment reviews, missing documents, applications awaiting action, open support, and assistant workload. Keep technical database visibility checks in System Health. Each count must have a clear definition and open the corresponding filtered page.

Applications should support global searching, filters, assignment views, and application detail navigation. Learners should provide a separate directory with profile, province, assigned assistant, and related applications. Avoid duplicating learners because they have several applications.

Assistants and Access should display staff accounts, assigned workload, current work, and permitted form types. Connect account creation to the existing controlled assistant account API. Allow master admins to inspect and change supported form permissions and assign or reassign learners/applications. Check assignment compatibility with form access. Explain the impact before confirming a reassignment. Do not add automatic assignment or account suspension controls unless supported by the backend.

Users and Roles should accurately display existing accounts and their roles. Existing role visibility does not imply that arbitrary role changes, user deletion, or suspension APIs exist. Expose only supported operations and identify missing backend capabilities separately.

Payment Review should show the learner, application, package, amount in ZAR, available transaction or proof information, payment status, and review history. Master admins can verify or reject using the existing payment review action, with an appropriate reason. Distinguish a staff review decision from a payment provider transaction outcome. Do not invent refund, charge, or payment-provider actions.

Provide dedicated content list and editor pages:
- Institutions: supported institution records, application availability, and open/closed or enabled/disabled settings. Add course editing only if a real API supports it.
- Career Hub: articles, resources, jobs, internships, and learnerships, including supported media, location, work arrangement, deadlines, application links, and draft/published/archived states.
- Housing: listings, room categories, location, rent, media, contact details, publication state, and service availability controls.
- Question Papers: supported subject/year metadata, papers and memos, uploads, publication/visibility controls, and existing edit/delete operations.
- Announcements: supported audience targeting, urgency, draft/active state, scheduling, and expiry.

Preserve the existing content APIs and publication rules. Give editors clear save feedback, validation, preview where supported, and protection against losing unsaved work. Previewing or saving a draft must not accidentally publish it.

6. SHARED APPLICANT WORKSPACE

Use one consistent applicant workspace with role-specific actions. The header should identify the learner, application reference, application type, current processing status, assigned assistant, and primary next action.

Organize the record into clear tabs:
- Overview: readiness, blockers, package, choices, and next actions.
- Profile and Academics: personal/contact information, guardian details, school, subjects, marks, and specialized application fields.
- Institutions and Courses: the selected institutions and course choices, with existing institution references and recorded outcomes.
- Documents: files, previews, review states, reasons, and review history.
- Payments: package/payment details; read-only for assistants and supported review controls for master admins.
- Updates and Timeline: processing changes, payment events, assignments, document reviews, and learner-visible updates, labelled by event type and source.
- Support: related tickets and conversations, plus callbacks where available.
- Internal Notes: clearly marked staff-only information, separate from learner-visible updates.
- Portal Details: institution portal URLs, application/student numbers, usernames, delivery notes, and supported access details.

Mask passwords and PINs by default. Provide authorized reveal/copy controls where the backend supports secure access. Do not place secrets in queue rows, activity feeds, logs, or analytics. If the existing storage/access design needs improvement, report the required backend work instead of implying the UI has solved it.

Preserve every existing applicant field and supported action. Keep actions attached to the correct application when a learner has multiple records. Long records should remain easy to navigate through tabs and section links.

7. STATUS AND PERMISSION RULES

Keep application processing, payment, document review, support, callback, publication, and learner-visible institution updates as separate status models. An application's processing label must not silently change payment verification or document approval.

Inspect the existing status values and mappings before implementing filters. Processing states include draft/package/payment stages, missing information/documents, review, institution submission, ready/applied, feedback, and final outcomes. Existing aliases must remain compatible until an explicit migration is designed. Documents use Pending Review, Approved, and Rejected; callbacks use Pending, Contacted, and Resolved. Preserve the support and payment values actually used by the backend.

Do not force all work into one linear progress bar: payments, documents, and institution choices can progress independently. Give a clear explanation for any derived readiness or completion indicator.

Enforce permissions through the server/API and existing Supabase row-level policies, not only by hiding buttons. Assistant searches, counts, files, direct URLs, and detail requests must respect assignment and form permissions. Verify deployed capabilities rather than assuming every local migration is already applied.

8. IMPLEMENTATION, STATES, AND ACCEPTANCE

Inspect these existing sources first: KAGIE_PROJECT_BIBLE.md; assistant/dashboard.html; assistant/applicant-view.html; assistant/documents-review.html; master-admin/dashboard.html; master-admin/application-view.html; admin/users/index.html; the corresponding js/*-page.js files; js/backend.js; and relevant Supabase schemas/migrations.

The current admin interfaces use HTML/JavaScript and window.KagieAPI with Supabase-backed operations. For a new frontend, React, TypeScript, Tailwind CSS, and Lucide are preferred. Use Next.js where it fits the existing deployment. Choose the integration approach after inspecting the repository, preserve login/session handling and existing entry links, and avoid rewriting unrelated learner flows or backend behavior.

Reuse the actual API operations for document reviews, notes, support replies, callbacks, status updates, learner updates, portal details, assignments, payments, assistant creation, form permissions, and content management. Create a clean adapter where needed. Never replace these with disconnected mock actions that appear to save live data.

Implement loading, empty, filtered-empty, failed, unavailable, permission-denied, expired-session, validation, saving, and saved states. Preserve form input on failures, provide retry, and show success only after persistence succeeds. Prevent duplicate submissions. Confirm consequential operations such as reassignment, deletion, and publication. Preserve existing audit logging and distinguish user-facing errors from diagnostic details.

Deliver a role/permission matrix, route map, shared design components, connected role-specific pages, and a short integration report. Clearly list any feature that needs unavailable backend support. Keep demonstration data isolated and visibly labelled.

Verify these complete workflows:
- Assistant signs in, opens an assigned application, reviews a document, records a processing change with an appropriate learner-visible update, replies to support, and returns to the same filtered queue.
- Master signs in, inspects a learner, assigns an eligible assistant, reviews a payment, manages assistant form access, and edits/publishes supported content.
- An assistant cannot access an unassigned or disallowed application through navigation, search, file access, or a manually changed URL.
- Refresh, browser Back, direct links, mobile navigation, keyboard operation, and recoverable API errors all work.

The final result should let assistants process their assigned work confidently and let master admins understand and manage the entire operation without searching through one oversized dashboard.
```
