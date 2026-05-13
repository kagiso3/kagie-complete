# Kagie Android App

The real Android app source currently lives in `../kagie-mobile`.

That project is an Expo/React Native Android app with native Android output under `../kagie-mobile/android`, package name `com.kagie.app`, app name `Kagie`, splash assets, secure storage, cached data, offline queues, dashboard, applications, documents, notifications, profile, and admin screens.

This folder exists as the clean Android app entry point requested for the production structure. Its package scripts delegate to the native app source instead of duplicating the whole project.

## Build Debug APK

```bash
npm --prefix ../kagie-mobile run build:android:debug
```

Generated APK:

```text
../kagie-mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Copy APK For Vercel Download

```bash
node ../scripts/copy-android-apk.cjs
```

Vercel download location:

```text
../website/public/downloads/kagie-android.apk
```

## Release Notes

The debug APK is installable for testing. For public distribution, create a signed release APK or AAB and copy the signed APK to `website/public/downloads/kagie-android.apk`, or publish the AAB through Google Play Console.
