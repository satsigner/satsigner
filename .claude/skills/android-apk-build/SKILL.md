---
name: android-apk-build
description: Build local Android APKs for satsigner — dev (debug) and production (release). Use when the user wants to build an APK, test on a device, or sideload the app.
version: 1.1.0
---

# Android APK Build (Local)

Build APKs directly on this machine without EAS cloud. All commands run from `apps/mobile/android/`.

## Per-branch / per-PR variants (`pnpm variant`)

Use `pnpm variant` (from `apps/mobile/`) to build coexisting installs, each with a unique Android package id derived from a suffix. Because Android sandboxes storage (MMKV, SQLite, secure store) per package id, each suffix keeps its own isolated, persistent database — so switching git branches never forces a DB reset.

```bash
pnpm variant                                # current git branch -> unique id
pnpm variant -- --suffix pr453              # explicit suffix
pnpm variant -- --plain                     # no suffix (default dev id)
pnpm variant -- --release --device          # standalone prod-mode build
pnpm variant -- --apk --suffix pr453 --release   # named APK, no install
```

Flags: `--suffix <v>`, `--plain`, `--prod`, `--release`, `--prebuild-only`, `--apk`, `--ios`; anything else (e.g. `--device Pixel_9`) passes through to `expo run:*`.

The script sets `APP_VARIANT_SUFFIX`, runs `expo prebuild --clean` (which rebakes the package id, since it is compiled into `android/`), then builds. `--apk` copies the Gradle output to `dist/apks/satsigner-<dev|prod>-<suffix>-<release|debug>.apk`.

Changing suffix requires a re-prebuild (handled automatically). To remove a variant: `adb uninstall com.satsigner.satsigner.dev.<segment>`.

## Standalone vs. Metro-connected builds

This project uses `expo-dev-client`. This matters for how the app runs:

| Build type | Runs standalone? | Notes |
|---|---|---|
| `assembleDebug` | **No** — shows Expo dev launcher, needs Metro running | Use only when actively developing with hot reload |
| `assembleRelease` | **Yes** — JS bundled in, no computer needed | Use for device testing, sharing, sideloading |

> For testing on a physical device without keeping a laptop nearby, always use `assembleRelease`.

---

## Prerequisites

### 1. Android SDK

The SDK must be at `~/Library/Android/sdk` (standard macOS location). If the build fails with `SDK location not found`:

```bash
echo "sdk.dir=$HOME/Library/Android/sdk" > apps/mobile/android/local.properties
```

> `local.properties` is gitignored — safe to create freely.

### 2. Native folder must be prebuilt

The `apps/mobile/android/` folder must exist. If it's missing or `app.config.ts` / native plugins changed, run prebuild first:

```bash
# Dev variant (default — different package/name from production)
cd apps/mobile && pnpm run prebuild:dev

# Production variant
cd apps/mobile && pnpm run prebuild:prod
```

Do NOT run prebuild just to rebuild — only when the native folder is missing or config changed.

---

## Standalone release APK (recommended for device testing)

### Dev variant — standalone, no Metro needed
- App name: `satsigner (Dev)`, package: `com.satsigner.satsigner.dev`
- Installs alongside the production app
- Requires a signing keystore (any key works for testing)

**Step 1 — Generate a throwaway keystore (one-time setup):**

```bash
keytool -genkey -v \
  -keystore apps/mobile/android/debug-release-key.jks \
  -alias satsigner -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Test, OU=Test, O=Test, L=Test, S=Test, C=US" \
  -storepass android -keypass android
```

**Step 2 — Build:**

```bash
cd apps/mobile/android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=$(pwd)/debug-release-key.jks \
  -Pandroid.injected.signing.store.password=android \
  -Pandroid.injected.signing.key.alias=satsigner \
  -Pandroid.injected.signing.key.password=android
```

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

**Install:**

```bash
adb install apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

---

## Debug APK (Metro-connected dev mode)

Only useful when you want live reload / dev tools. Requires Metro running on the same machine.

```bash
cd apps/mobile/android
./gradlew assembleDebug
```

Output: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

Start Metro before launching the app:

```bash
cd apps/mobile && pnpm start
```

---

## Production release APK (for distribution)

Uses the production variant (`com.satsigner.satsigner`, name `satsigner`). Requires prebuild with production variant first.

```bash
# 1. Prebuild with production config
cd apps/mobile && pnpm run prebuild:prod

# 2. Build release (use your real keystore here)
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=/path/to/release-key.jks \
  -Pandroid.injected.signing.store.password=YOUR_PASSWORD \
  -Pandroid.injected.signing.key.alias=YOUR_ALIAS \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD
```

---

## When to re-run prebuild

| Changed | Re-run prebuild? |
|---|---|
| JS/TS source files | No |
| `app.config.ts` (name, package, scheme) | Yes |
| Added/removed a native Expo plugin | Yes |
| `apps/mobile/android/` folder missing | Yes |
| Just rebuilding APK with same config | No |

---

## Troubleshooting

**`SDK location not found`** → write `local.properties` (see Prerequisites)

**App shows Expo dev launcher instead of app** → you built `assembleDebug`; use `assembleRelease` instead

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`** → uninstall the existing app first:
```bash
adb uninstall com.satsigner.satsigner.dev   # dev variant
adb uninstall com.satsigner.satsigner       # production variant
```

**`INSTALL_FAILED_INVALID_APK` or signature mismatch** → uninstall first, then reinstall (different keystore than what was previously installed)
