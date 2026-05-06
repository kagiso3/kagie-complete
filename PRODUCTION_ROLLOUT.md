# Kagie Production Rollout

## Current Truth

Kagie is currently strong as a polished MVP, but the public web app is still demo-first because:

- student data is primarily stored in browser `localStorage`
- admin actions are client-side only
- uploads are not yet secured by real cloud storage access rules
- payment capture is workflow-only, not gateway-backed
- audit, recovery, and monitoring are not production-grade yet

This file defines the production path from the current MVP to a public launch.

## Production Target

Public Kagie should run with:

- web frontend deployed as static or SPA hosting
- Node.js API handling all trusted business logic
- Supabase Postgres storing user, application, cart, document, and support data
- Supabase Auth handling login/session identity
- Supabase Storage handling private document uploads
- role-based API authorization for `user`, `assistant_admin`, and `master_admin`
- observability, backups, environment separation, and launch controls

## Release Gates

Do not publicly launch Kagie until all of these are complete:

1. Real auth and session persistence
2. Real database-backed applications and carts
3. Secure document storage and access control
4. Server-side admin-only assistant creation
5. Payment verification process owned by the backend
6. Error logging and uptime monitoring
7. Terms, privacy, and support contact information finalized
8. Staging environment tested before production cutover

## Phase 1: Backend Foundation

Goal: move Kagie from browser-only state to trusted server state.

Deliverables:

- shared types package in `packages/shared`
- Node API in `kagie-api`
- production schema in `supabase/schema.sql`
- env separation for local, staging, and production

Immediate work:

1. Replace in-memory API stores with Postgres repositories.
2. Wire API auth to Supabase JWT verification or a server-owned JWT system.
3. Create database-backed versions of:
   - users
   - profiles
   - draft applications
   - carts
   - notifications
   - documents
   - support threads

## Phase 2: Student Flow Migration

Goal: keep the existing Kagie UI, but move reads and writes to the API.

Pages to migrate first:

1. `signup.html`
2. `login.html`
3. `forms.html`
4. `cart.html`
5. `checkout.html`
6. `Dashboard.html`
7. `profile.html`
8. `upload.html`
9. `notifications.html`

Migration rule:

- every current `window.KagieAPI` demo method should gain a server-backed equivalent
- demo mode can remain behind a flag, but production mode must not use browser storage as source of truth

## Phase 3: Admin Hardening

Goal: make assistant and master admin workflows safe enough for real staff use.

Required changes:

1. Assistant account creation must happen only through a protected server route.
2. Application assignment must be server-side audited.
3. Notes, document reviews, and callback updates must be timestamped and attributable.
4. Admin dashboards must read from the API, not local browser state.

## Phase 4: Document Security

Goal: turn uploads into a real private document workflow.

Required changes:

1. Upload to a private storage bucket.
2. Store metadata in `documents`.
3. Restrict access so:
   - students can read only their own files
   - assistants and masters can read assigned or authorized files
4. Save review decisions in `document_reviews`.

## Phase 5: Payment Productionization

Goal: remove trust from the client.

Required changes:

1. Payment submissions must be stored server-side.
2. Payment status changes must be made by staff or verified webhook logic.
3. Checkout must never be the source of final application status on its own.
4. Audit all payment transitions.

Recommended launch posture:

- if no payment gateway is integrated yet, launch with clearly labeled manual verification
- do not imply instant payment verification unless a real gateway and webhook flow exist

## Phase 6: Ops and Compliance

Goal: make Kagie resilient enough for public users.

Required controls:

1. Staging and production environments
2. Secret management outside the frontend
3. Daily database backups
4. Error monitoring
5. Uptime monitoring
6. Admin action audit logs
7. Rate limiting on auth routes
8. Password reset flow
9. Verified support contact details

## Suggested Deployment Shape

### Frontend

- Vercel for static hosting and serverless routes

### API

- Render, Railway, Fly.io, or a VPS/container platform

### Database/Auth/Storage

- Supabase project with separate staging and production instances

## Launch Environments

Create these environments before public rollout:

1. `local`
   - developer machines
2. `staging`
   - full production-like test environment
3. `production`
   - public Kagie deployment

Each environment needs:

- its own auth config
- its own database
- its own storage bucket setup
- its own frontend API base URL

## Recommended Build Order From Here

1. Finish Postgres-backed repositories in `kagie-api`
2. Migrate auth from demo mode to real API auth
3. Migrate student flow pages to API-backed mode
4. Migrate admin flow pages to API-backed mode
5. Secure uploads and document review
6. Add monitoring, staging, and QA checklist
7. Open public beta

## What I Recommend We Build Next

The next best engineering step is:

1. connect `kagie-api` to the production schema
2. implement database-backed auth/profile/application/cart routes
3. then point `forms.html`, `cart.html`, and `checkout.html` at the API

That is the shortest path from today’s MVP to a real public Kagie rollout.
