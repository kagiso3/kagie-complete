# Kagie Mobile

Kagie Mobile is the Android app for South African tertiary application support.

## What it includes

- student login and registration
- mobile dashboard
- learner, guardian, school, marks, package, and institution application flow
- cart and payment submission
- notifications and support chat
- callback requests
- prospectus highlights, updates, and extra services

## Run locally

1. create `kagie-mobile/.env` from `.env.example`
2. make sure the Kagie API is running
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

Then submit:

```bash
npm run submit:android
```
