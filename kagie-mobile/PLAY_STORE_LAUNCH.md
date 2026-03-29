# Kagie Play Store Launch

This file is the step-by-step handoff for taking Kagie Mobile to the Google Play Store.

## What is already prepared

- Android package name: `za.co.kagie.app`
- EAS config: `kagie-mobile/eas.json`
- App icon: `kagie-mobile/assets/icon.png`
- Adaptive icon: `kagie-mobile/assets/adaptive-icon.png`
- Splash screen: `kagie-mobile/assets/splash.png`
- Feature graphic draft: `kagie-mobile/assets/play-store-feature-graphic.png`
- In-app privacy policy reference: `https://kagie.app/privacy.html`

## 1. Make sure the Kagie API is live

The mobile app needs a reachable API base URL.

For local Android testing, the working file now exists:

- `kagie-mobile/.env`

For production, copy:

- `kagie-mobile/.env.production.example`

to:

- `kagie-mobile/.env`

With:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-live-api-domain/v1
```

For local Android emulator testing, the example remains:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/v1
```

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

This will create an `.aab` build for Google Play.

## 4. Create the Play Console app

In Google Play Console:

1. Click `Create app`
2. App name: `Kagie`
3. Default language: `English (United States)` or your preferred English locale
4. App type: `App`
5. Paid or free: choose the business model you want

## 5. Prepare store listing details

Suggested values:

- App name: `Kagie`
- Short description:
  - `Apply to South African universities and colleges with guided support.`
- Full description:
  - `Kagie helps South African learners apply to universities, TVET colleges, and other tertiary institutions from one place. Fill in your details once, choose your application package, build your shortlist, track your application progress, receive notifications, and get support from Kagie assistants.`
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

Submit Android:

```bash
npm run submit:android
```
