Place the real Kagie Android APK here as:

```text
kagie-android.apk
```

This file is intentionally not committed because APK files are ignored in git. Use:

```text
npm run build:android:debug
npm run copy:android-apk
```

The Vercel build copies this folder into `web-release/downloads`.
