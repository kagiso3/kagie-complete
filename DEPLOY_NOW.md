# Kagie Deploy Now

Kagie is now prepared for a public web deployment using:

- Static frontend on Netlify
- Supabase for auth and application data
- Netlify Function for secure assistant account creation

## 1. Fill public payment and support details

Open:

- `C:\Users\LENOVO\Downloads\kagie-complete\js\supabase-config.js`

Update these values inside `SITE_CONFIG`:

- `supportPhone`
- `supportEmail`
- `payments.bankName`
- `payments.accountNumber`
- `payments.accountType`
- `payments.branchCode`
- `payments.referencePrefix`

If you already know the final support details, this is the one place to set them for the deployed web app.

## 2. Push the project to GitHub

Create a GitHub repository and upload this project folder.

## 3. Deploy to Netlify

In Netlify:

1. Create a new site from Git
2. Select the Kagie repository
3. Leave the publish directory as `.`
4. Build command can stay empty

Netlify will use:

- `netlify.toml`
- `netlify/functions/admin-assistants.js`

## 4. Add Netlify environment variables

In Netlify Site Settings -> Environment Variables, add:

- `SUPABASE_URL`
  - `https://ztfcxnowjtvonltevrqe.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`
  - your rotated Supabase service role key

Do not place the service role key in frontend files.

## 5. Redeploy the site

Trigger a fresh deploy after saving the environment variables.

## 6. Final live test

Test this exact path:

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

## 7. Optional custom domain

After the live test passes:

1. Add your custom domain in Netlify
2. Update DNS
3. Re-test login, checkout, dashboard, and assistant creation

## Notes

- Kagie no longer needs a separate public API host just to create assistants.
- The Netlify function now handles secure assistant creation server-side.
- The frontend already points to the Netlify function in production and to `localhost:4000` during local development.
