# Kagie Deploy Now

Kagie is now prepared for a public Vercel deployment using:

- Static frontend from `web-release`
- Vercel serverless routes in `api/*`
- shared server handlers in `server/functions`
- Supabase for auth and application data

## 1. Build the release bundle

From the project root run:

- `npm run build`

This refreshes:

- `web-release`

## 2. Import into Vercel

In Vercel:

1. Create a new project
2. Import the Kagie repository
3. Use build command `npm run build`
4. Use output directory `web-release`

## 3. Add Vercel environment variables

In Vercel Project Settings -> Environment Variables, add:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YOCO_SECRET_KEY`
- `YOCO_WEBHOOK_SECRET`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `RESEND_API_KEY` if using email broadcasts
- `MARKETING_FROM_EMAIL`
- `MARKETING_REPLY_TO_EMAIL`
- `TWILIO_ACCOUNT_SID` if using SMS broadcasts
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Do not place the service role key in frontend files.

## 4. Deploy and test

After saving the environment variables, trigger a production deployment and test:

1. `signup.html`
2. `login.html`
3. `forms.html`
4. `cart.html`
5. `checkout.html`
6. `Dashboard.html`
7. `master-admin/dashboard.html`
8. Create an assistant account
9. Log in as that assistant
10. Open `assistant/dashboard.html`

## Notes

- Kagie now uses Vercel routes under `api/*` with rewrites from `/v1/*`.
- Shared secure handlers now live in `server/functions`.
- The frontend loads its public Supabase config at runtime and keeps secure keys server-side only.
