# MzansiConnect Android app

A small Android app (Capacitor) that opens the live MzansiConnect website full screen, so there is one product to maintain.
Sellers can pick or take photos inside the app. If the phone is offline the app shows a "No connection" screen.

- Built on GitHub by `.github/workflows/android-app.yml`; the download is published at
  https://github.com/hlulanij/hlulanij/releases/tag/android
- `capacitor.config.json` holds the site address and app id (`com.mzansiconnect.app`).
- `assets/` are the icon and splash sources.
- `preview.keystore` signs the **preview** builds only. Its password is public in the workflow, so it is NOT secure.
  Before publishing to Google Play, create a private keystore and keep it out of the repository.
