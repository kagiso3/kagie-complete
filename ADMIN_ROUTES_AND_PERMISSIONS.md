# Kagie admin routes and permissions

Updated 5 October 2026. These routes use the existing Kagie HTML application, Supabase Auth, and database. Production activation requires the migrations in `ADMIN_UI_SETUP.md`.

## Routes

| Area | Master Admin | Assistant Admin |
| --- | --- | --- |
| Overview | `/master-admin/dashboard.html?page=overview` | `/assistant/dashboard.html?page=overview` |
| Applications | `?page=applications` | `?page=assigned` |
| Learners | `?page=learners` | `?page=learners` |
| Assistants and access | `?page=assistants` | `?page=forms` displays own form access |
| Payment review | `?page=payments` | Read-only Payments tab in an assigned application |
| Document review | `?page=documents` | `?page=documents` |
| Support inbox | `?page=messages` | `?page=messages` |
| Callbacks | `?page=callbacks` | `?page=callbacks` |
| Accommodation | `?page=accommodation` | `?page=accommodation` |
| CV Revamp | `?page=cv` | `?page=cv` |
| Jobs and opportunities | `?page=jobs` | `?page=jobs` |
| Institutions | `?page=institutions` | `?page=institutions`, only with explicit grant |
| Career articles/resources | `?page=career` | — |
| Question papers | `?page=papers` | — |
| Announcements | `?page=announcements` | `?page=announcements` displays permitted notices |
| Learner updates | `?page=updates` | `?page=updates` |
| Service content | `?page=management` | — |
| Users and roles | `?page=users` | — |
| Activity | `?page=audit` | `?page=activity` |
| System health | `?page=health` | — |
| Account | `?page=more` | `?page=more` |

The query-only entries above belong to their role's `dashboard.html`. Root `/master-admin.html` and `/assistant-admin.html` remain aliases to the protected dashboards.

The shared application workspace is `/master-admin/application-view.html?id=<application UUID>&tab=<tab>` or `/assistant/applicant-view.html?id=<application UUID>&tab=<tab>`. Tabs are `overview`, `profile`, `institutions`, `documents`, `payments`, `updates`, `support`, `notes`, and `portal`. `thread=<UUID>` restores the selected support conversation. Legacy `userId` links resolve an accessible application through an authoritative query.

Accommodation adds `view=overview|listings|review|availability|providers|requests`. CV adds `request=<UUID>&cvtab=personal|summary|education|experience|skills|certifications|languages|references|additional|conversation|notes|files`. Queue search, status, pagination and selected support tickets use URL parameters. Back, refresh and direct links restore these views.

## Role matrix

| Operation | Master Admin | Assistant Admin | Learner |
| --- | --- | --- | --- |
| Read applications | All | Assigned plus permitted form and application service | Own |
| Change processing status | Yes | Accessible application | Existing learner form flow |
| Assign application or CV | Yes, eligible assistants | No | No |
| Change form/service grants | Yes | Read own grants | No |
| Verify/reject payment | Yes | Read only | Own provider/payment flow only |
| Review documents | Yes | Accessible application documents; assigned CV scope | Read own results/upload own files |
| Internal notes | Yes | Accessible staff workspace | No |
| Learner updates | Yes | Accessible application plus updates grant | Read own |
| Support/callbacks | All permitted staff operations | Assigned learner/thread plus service grant | Own conversations/requests |
| Housing | Manage/assign/publish/archive | Own or assigned listings, action grants | Published active listings/own requests |
| CV | All requests, assignment, editing and delivery | Assigned request, action grants | Upload source, receive final file and messages |
| Jobs | Create/review/edit/publish/unpublish/archive | Own drafts; submission; privileged publishing | Published unexpired opportunities |
| Content | Institutions, articles, papers, notices and service settings | Institution controls only if explicitly granted | Published learner content |
| Staff account creation | Existing protected server endpoint | No | No |
| Users/roles | Inspect real directory and roles | Assigned learners only | Own profile |
| Audit | Platform staff activity | Own activity | No |
| Private files | Authorized staff access | Matching application/CV/content scope | Own files and published learning resources |

## Assistant action grants

| Parent service | Action keys |
| --- | --- |
| `applications` | Accessible applications and their document workspace; form grants also apply |
| `support` | Support inbox and callbacks |
| `updates` | Learner-visible application updates |
| `accommodation` | `housing_create`, `housing_edit`, `housing_availability`, `housing_requests`, `housing_publish` |
| `cv` | `cv_edit`, `cv_message`, `cv_upload`, `cv_review`, `cv_complete` |
| `jobs` | `jobs_create`, `jobs_edit`, `jobs_submit`, `jobs_unpublish`; `publish_jobs` delegates direct publication |
| `institutions` | Explicitly delegated institution controls |

Every child action also needs its parent service. Independent availability, CV review/completion, and job unpublish actions do not require general editing. Existing ordinary work grants retain backward-compatible defaults when no permission row exists. `institutions`, `publish_jobs`, `housing_publish`, and `jobs_unpublish` default to false. Master Admin can replace defaults with explicit grants or revocations.

The registered application types remain Undergraduate, Bridging, Transfer, Postgraduate, and Late Applications. Assignment checks the registry and the target assistant's form grants. Counts, profile searches, direct IDs, support records and private file signing use database access rules; hidden buttons alone do not grant or revoke access.

Deletion of historical applications, CV versions, reviews and audit records is not exposed. Content can be archived or unpublished, retaining its data and files. Arbitrary role changes, suspension and account deletion are not invented.
