# Kagie Play Store Launch

This file is the handoff for taking Kagie Mobile to Google Play as a native Android app.

## What is already prepared

- Android package name: `com.kagie.app`
- Version: `1.2.0`
- Version code: `6`
- Target SDK: Android API `36` (meets the Android 15 / API 35+ Play requirement)
- EAS config: `kagie-mobile/eas.json`
- App icon: `kagie-mobile/assets/icon.png`
- Adaptive icon: `kagie-mobile/assets/adaptive-icon.png`
- Splash screen: `kagie-mobile/assets/launch-logo.png`
- Feature graphic draft: `kagie-mobile/assets/play-store-feature-graphic.png`
- In-app privacy policy reference: `https://kagie.app/privacy.html`
- Local release AAB output after build: `kagie-mobile/android/app/build/outputs/bundle/release/app-release.aab`

## 1. Make sure the live Kagie API is ready

The Android app is native and now depends on the Kagie API instead of loading the website inside a WebView.

Use:

- `kagie-mobile/.env.production.example`

Production should point to:

```env
EXPO_PUBLIC_KAGIE_API_BASE_URL=https://your-vercel-production-domain.vercel.app/v1
```

Play Store builds should point to the live Kagie API on Vercel, preferably a custom domain or your production Vercel deployment URL ending in `/v1`. Do not point Play Store builds at retired Kagie domains such as `kagie.co.za`.

## 2. Install Expo EAS CLI

```bash
npm install -g eas-cli
eas login
```

## 3. Build the Android App Bundle

From `kagie-mobile`:

```bash
eas build --platform android --profile production
```

Choose the `production` profile if prompted.

This creates an `.aab` build for Google Play.

Local Windows build option:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
npm run build:android:local-aab
```

Guarded Play Store build option:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:EXPO_PUBLIC_KAGIE_API_BASE_URL="https://your-vercel-production-domain.vercel.app/v1"
npm run build:android:play-aab
```

The guarded command refuses to build if the API URL is missing, non-HTTPS, local/emulator/LAN, `kagie.co.za`, or not ending in `/v1`.

## 4. Create the Play Console app

In Google Play Console:

1. Click `Create app`
2. App name: `Kagie`
3. Default language: `English`
4. App type: `App`
5. Paid or free: choose the business model you want

## 5. Prepare store listing details

Suggested values:

- App name:
  - `Kagie`
- Short description:
  - `Apply to South African universities and colleges with guided support.`
- Full description:
  - `Kagie helps South African learners apply to universities, TVET colleges, and other tertiary institutions from one Android app. Learners can create an account, fill in their forms, save draft progress, upload documents, manage institution choices, check cart and payment status, request support, read notifications, and keep their application journey in one mobile dashboard.`
- Support email:
  - `kagisowitness79@gmail.com`
- Privacy policy:
  - `https://kagie.app/privacy.html`

## 6. Assets you still need

You still need to upload real store screenshots from the running app:

- phone screenshots
- optional tablet screenshots if you support tablets

The feature graphic draft already exists here:

- `kagie-mobile/assets/play-store-feature-graphic.png`

## 7. Complete Play Console policy sections

Expect to complete:

- App access
- Data safety
- Ads declaration
- Content rating
- Target audience
- Privacy policy

Suggested Data Safety notes:

- Personal info: name, email, phone, learner profile details, guardian/school details.
- Files and docs: learner uploads documents only when they choose a file.
- Financial info: payment reference/status only; Yoco or any card checkout must be created by the backend and never stores secret keys in the app.
- Data is transmitted over HTTPS to the Kagie API and protected by authenticated backend routes.
- The app stores secure auth/session data and draft form progress locally so learners do not lose work offline. It does not cache sensitive document contents.

## 8. Upload the Android build

In Play Console:

1. Go to `Testing` -> `Internal testing`
2. Create a release
3. Upload the `.aab` file from EAS
4. Save
5. Roll out to internal testing first

## 9. Submit after testing

After internal testing passes:

1. Move to a broader testing track or production
2. Complete all missing Play Console declarations
3. Submit for review

## 10. Useful commands

Type check:

```bash
npm run typecheck
```

Build Android:

```bash
npm run build:android
```

Build local AAB:

```bash
npm run build:android:local-aab
```

Verify release config:

```bash
npm run verify:android-release
```

Submit Android:

```bash
npm run submit:android
```
