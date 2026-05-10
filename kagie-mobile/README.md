# Kagie Mobile

Kagie Mobile is the native Android app for Kagie.

## What it includes

- native React Native and Expo Android app
- secure login and registration flow
- native tabs for Home, Apply, Documents, Cart, Inbox, Explore, and Profile
- direct API integration with the Kagie `/v1` backend
- local token storage with `expo-secure-store`
- offline-safe cached session and draft saving for learner forms
- Android document picker uploads through the Kagie API, not through a website WebView
- protected master admin institution controls for opening and closing applications

## Environment setup

Development example:

```env
EXPO_NO_METRO_WORKSPACE_ROOT=1
EXPO_PUBLIC_KAGIE_API_BASE_URL=http://10.0.2.2:4000/v1
```

Production example:

```env
EXPO_NO_METRO_WORKSPACE_ROOT=1
EXPO_PUBLIC_KAGIE_API_BASE_URL=https://your-vercel-production-domain.vercel.app/v1
```

Production builds should point to the live Kagie API on Vercel, preferably a custom domain or your production Vercel deployment URL ending in `/v1`. Do not point production builds at retired Kagie domains such as `kagie.co.za`.

## Run locally

1. make sure the Kagie API is running
2. set `kagie-mobile/.env`
3. run:

```bash
npm run start
```

For Android emulator:

```bash
npm run android
```

## Type check

```bash
npm run typecheck
```

## Android build

Use Expo EAS:

```bash
npm run build:android
```

Or create a local Android App Bundle:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
npm run build:android:local-aab
```

For a Play Store release, use the guarded command so Kagie does not accidentally ship with a local or retired URL:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:EXPO_PUBLIC_KAGIE_API_BASE_URL="https://your-vercel-production-domain.vercel.app/v1"
npm run build:android:play-aab
```

The release verifier rejects `localhost`, `10.0.2.2`, LAN addresses, `kagie.co.za`, non-HTTPS URLs, and public Expo env var names that look like secrets.

Then submit:

```bash
npm run submit:android
```

## Release note

This app no longer boots the Kagie website inside a WebView. It now launches the native mobile session flow and native Kagie screens backed by the `/v1` API.

If the API is unavailable, the app still opens, restores the cached secure session where possible, shows an offline notice, and keeps learner draft changes queued for sync. Sensitive files are not cached locally; document uploads require internet and are sent to the backend with the user's existing auth token.
