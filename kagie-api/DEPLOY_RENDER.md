# Deploy Kagie API on Render

This is the fastest path to get a live API URL for Kagie Mobile.

## 1. Push the latest repo changes to GitHub

Make sure `render.yaml` is in the repo root.

## 2. Create the Render service

1. Sign in to Render
2. Click `New` -> `Blueprint`
3. Connect your GitHub repo
4. Render will detect `render.yaml`
5. Create the service

## 3. Set environment values

In Render:

- `WEB_APP_URL`
  - your live Kagie web domain, for example `https://kagie.app`
- `SUPABASE_URL`
  - your Supabase project URL
- `SUPABASE_ANON_KEY`
  - your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`
  - your rotated Supabase service role key kept server-side only

Render will auto-generate:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

## 4. Wait for deploy

When deploy succeeds, your API URL will look like:

```text
https://kagie-api.onrender.com
```

## 5. Put that URL into Kagie Mobile

Update:

- `kagie-mobile/.env`

to:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-render-url.onrender.com/v1
```

Then run the Android build.
