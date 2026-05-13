# Kagie Vercel Website

This folder holds website-only assets that are copied into the Vercel release output.

The Android app is a separate native React Native/Expo project in `kagie-mobile`. Vercel hosts only the website and the downloadable APK file.

## Android Download File

Build or copy the Android APK to:

```text
website/public/downloads/kagie-android.apk
```

After deployment, users download it from:

```text
/downloads/kagie-android.apk
```

If the APK is missing, `android-app.html` shows a clear unavailable message and still lets users open the Kagie web app.
