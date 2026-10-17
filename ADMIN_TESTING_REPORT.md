# Kagie admin testing report

Test date: 5 October 2026. Results: **59 database checks and 42 browser checks passed**. The release and syntax checks are recorded separately below.

## Database verification

`node scripts/test-admin-database.cjs` executes the repository's actual SQL migrations in isolated PGlite PostgreSQL 0.5.8 with pgcrypto. New workflow migrations are compiled with function-body checks enabled. Synthetic identities model Master, Assistant and two learners, and queries run as the authenticated database role with the relevant user claim. Supabase Auth and Storage metadata schemas are represented by a small test schema.

The 59 checks cover assignment and form restrictions, inaccessible IDs/counts/profile searches, role forgery, payment restrictions, CV creation/assignment/versioning/final-file requirements, exact CV document scope, private storage read/write access, immutable submitted/published images, action-grant independence and parent revocation, opportunity publication/expiry, separate review state systems, staff-only notes, credential-free generated audit entries, public learning-resource compatibility, atomic portal history, historical CV conversations, capability checks and migration reapplication.

Exact results: `reports/admin-database-checks.json`.

## Browser integration

`node scripts/test-admin-integration.cjs` runs actual Chrome through Playwright at 1440×1000 and 390×844. It loads the real HTML, CSS, production backend and staff scripts with the actual Supabase browser SDK. An isolated HTTP adapter implements the Auth/REST/Storage protocol against the same real PostgreSQL/RLS model. Identity establishment is synthetic; it does not test hosted Supabase Auth or real passwords.

The 42 checks cover assigned-only queues, refreshable search/tabs/conversations, complete specialized form fields, private notes, learner updates, denied manual URLs, image picker/drop/replacement/persistence, Master publication, actual learner job-card image rendering after a fresh session and refresh, CV preview/DOCX content/version persistence, human replies, completion notification, actual learner revised-CV download, document rejection history, callbacks, housing persistence, announcements, payment-validation recovery, masked portal editing/removal/history, Master application/CV assignments, institutions, stored question papers, form/service revocation, independent CV actions, invalid images, simulated storage outage and real retry, mobile layout and deployed-capability checks. No uncaught browser runtime errors were recorded.

Exact results: `reports/admin-browser-checks.json`. Reviewed screenshots: `reports/admin-master-desktop.png` and `reports/admin-assistant-mobile.png`. Screenshots contain isolated QA data, not production records.

## Release checks

All 12 selected JavaScript files passed `node --check`, including the shared admin scripts and changed privileged server functions. Release packaging copied the current native pages/scripts/styles and existing Next.js landing export into `web-release`. Fourteen critical release files match their source byte-for-byte. The landing verifier passed with identical exported homepages, 16 required asset references and existing account/admin destinations. The release contains no local database harness, fixture credentials, reports or Supabase SQL files.

## Reproduction

```powershell
npm.cmd install --prefix .admin-test-runtime @electric-sql/pglite@0.5.8 --no-audit --no-fund --ignore-scripts
node scripts/test-admin-database.cjs
node scripts/test-admin-integration.cjs
node scripts/build-web-release.cjs
node kagie-landing/scripts/package-release.mjs
npm.cmd run test:landing
```

The browser runner uses the bundled Playwright runtime on this host and requires installed Chrome. The private `.admin-test-runtime` directory is ignored and not part of production dependencies. `npm.cmd run build:release` additionally rebuilds the public Next.js landing page when its source changes.

## Not verified live

No live database migration, production deployment, real hosted Auth lifecycle, secure assistant-account creation, production storage signing, payment-provider transaction or production server-function call is claimed. The local checks exercise real SQL and frontend behavior; the HTTP adapter does not prove PostgREST configuration, Storage service deployment or production policy drift.

After applying the reviewed migrations to a designated test Supabase project, repeat the user's complete Master/Assistant workflow with real accounts, both image input methods, a second session/device and denied direct API/storage requests. Verify the private bucket and deployed policies in System Health. Then validate the existing package/payment/upload flows with the configured provider's test mode before production activation.
