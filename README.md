# Kagie.app

Kagie is a South African student application and support platform. This project already includes the working student flow, dashboard tracking, support tools, and admin surfaces. It is designed to be extended carefully, not rebuilt from scratch.

See [KAGIE_PROJECT_BIBLE.md](./KAGIE_PROJECT_BIBLE.md) for the broader product vision and roadmap framing.

## What Kagie does now

The current Kagie project supports:

- student signup and login
- learner, guardian, school, and marks capture
- APS-aware application preparation
- institution and course selection
- package-based application limits
- add to cart and checkout
- payment proof submission and tracking
- notifications and reminders
- application tracking dashboard
- secure document uploads
- profile and support flows
- assistant and master admin dashboards
- accommodation request flow
- intercity transport request flow
- PayFast secure checkout plus South African manual payment methods

## Current package structure

- `Starter Pack` - `R250` - up to `10` institutions
- `Smart Choice Pack` - `R350` - up to `15` institutions
- `Ambition Pack` - `R450` - up to `20` institutions
- `Unlimited Pro Pack` - `R800` - unlimited institutions, but still respects deadlines

## Accommodation and transport

These two flows are now part of the live Kagie student experience.

### Accommodation

- browse housing listings
- compare property, location, room type, distance, and pricing
- select a listing and send a reservation request
- track accommodation requests from the dashboard
- master admin can add and edit listing photos, prices, addresses, provinces, and university links

Main files:
- [more-service/accommodation-assist.html](./more-service/accommodation-assist.html)
- [js/backend.js](./js/backend.js)
- [master-admin/dashboard.html](./master-admin/dashboard.html)

### Intercity transport

- browse route options
- filter by departure city, destination city, and company
- view departure and arrival times in a bus schedule-style layout
- choose a route and send a transport request
- track transport requests from the dashboard

Main files:
- [more-service/transport-assist.html](./more-service/transport-assist.html)
- [js/backend.js](./js/backend.js)

## Payments

Kagie now supports two payment paths inside the existing cart and checkout flow:

- `PayFast secure checkout` for online card and Instant EFT checkout
- South African manual payment options such as `EFT`, `Cash Deposit`, `Card Transfer`, and `Mobile Payment`

### PayFast live setup

Add these server-side environment variables in Vercel before using live PayFast checkout:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`

Then register this notify URL in PayFast:

- `https://your-domain/v1/payments/payfast/itn`

Main files:
- [checkout.html](./checkout.html)
- [js/checkout-page.js](./js/checkout-page.js)
- [server/functions/payfast-create-checkout.js](./server/functions/payfast-create-checkout.js)
- [server/functions/payfast-itn.js](./server/functions/payfast-itn.js)

## Main pages

### Student pages

- `index.html`
- `signup.html`
- `login.html`
- `home.html`
- `forms.html`
- `cart.html`
- `checkout.html`
- `Dashboard.html`
- `notifications.html`
- `upload.html`
- `profile.html`
- `prospectus.html`
- `personal-assistance.html`
- `more-service/index.html`
- `more-service/accommodation-assist.html`
- `more-service/transport-assist.html`
- `more-service/funding-assist.html`

### Assistant pages

- `assistant/dashboard.html`
- `assistant/applicant-view.html`
- `assistant/documents-review.html`

### Master admin pages

- `master-admin/dashboard.html`
- `master-admin/application-view.html`
- `master-admin/bootstrap.html` (one-time live master admin setup)

## How to run locally

### Static web app

1. Open the project folder.
2. Start a local server if possible, or open `index.html`.
3. Create a user account.
4. Test the student flow:
   - signup
   - login
   - forms
   - cart
   - checkout
   - dashboard

### Optional Node / React workspace

This repo also contains:

- `kagie-api` for the Node backend
- `kagie-mobile` for the mobile app
- `kagie-web` for the React web app scaffold

Those are optional for the static manual deploy path.

## Manual deploy

For the safest static deploy, use the cleaned bundle in:

- [web-release](./web-release)

Upload the contents of `web-release` to your static host.

### Recommended static hosts

- Vercel
- Cloudflare Pages
- GitHub Pages

### Vercel deploy

1. Open Vercel.
2. Import the Kagie repository or upload the project.
3. Use `npm run build` as the build command.
4. Use `web-release` as the output directory.
5. Add the required environment variables in Project Settings.

Do not upload the whole workspace if you only want the static site online. Use `web-release`.

### First live admin setup

After deploying, open:

- `your-domain/master-admin/bootstrap.html`

Use that page once to create the very first live `master_admin`. After that:

- log in normally at `login.html`
- open `master-admin/dashboard.html`
- create assistant accounts from the existing `Create Assistant Account` form

Important:

- the one-time live setup requires `SUPABASE_SERVICE_ROLE_KEY` on the serverless host
- once a master admin already exists, the bootstrap page stops working and sends future admins through the protected dashboard flow

## Supabase

Kagie can run with local/browser-side draft handling, but public rollout is stronger when connected to Supabase.

Supabase gives you:

- real authentication
- real storage
- real application data
- payment and document persistence
- stronger admin workflows

Important files:

- [supabase/schema.sql](./supabase/schema.sql)
- [supabase/update-pack-pricing.sql](./supabase/update-pack-pricing.sql)
- [js/supabase-config.js](./js/supabase-config.js)

## Notes before launch

- public `demo` wording has been removed from the live-facing app pages
- accommodation and transport now use real request flows and dashboard tracking
- if you deploy manually, deploy from `web-release`
- review your real Supabase keys, payment details, and admin access before public launch
