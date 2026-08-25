---
name: android-apk-build
description: Build local Android APKs for satsigner — standalone release for device testing/sharing, debug for Metro. Use when the user wants to build an APK, test on a device, sideload, or share a build.
version: 1.2.0
---

# Android APK Build (Local)

Build APKs on this machine without EAS cloud. Prefer **standalone release** when the user wants to test on a device or send an APK elsewhere (no Metro needed).

## Decision guide

| User intent | Build |
|---|---|
| Share / sideload / physical device without laptop | `assembleRelease` + signing (below) |
| Hot reload while developing | `pnpm variant -- --device` or `assembleDebug` + Metro |
| Coexisting branch install with unique package id | `pnpm variant` (see below) |

> If Metro / `pnpm variant -- --device` is already running, **do not** run `pnpm variant -- --apk` — it deletes `android/` via `prebuild --clean`. Build with Gradle against the existing tree instead.

---

## Per-branch / per-PR variants (`pnpm variant`)

From `apps/mobile/`:

```bash
pnpm variant                                # current git branch -> unique id
pnpm variant -- --suffix pr453              # explicit suffix
pnpm variant -- --plain                     # no suffix (default dev id)
pnpm variant -- --release --device          # standalone, install via expo
pnpm variant -- --apk --suffix pr453 --release   # named APK in dist/apks
```

Flags: `--suffix <v>`, `--plain`, `--prod`, `--release`, `--prebuild-only`, `--apk`, `--ios`; anything else (e.g. `--device Pixel_9`) passes through to `expo run:*`.

Sets `APP_VARIANT_SUFFIX`, runs `expo prebuild --clean`, then builds. `--apk` copies to `dist/apks/satsigner-<dev|prod>-<suffix>-<release|debug>.apk`.

**Signing caveat:** `--apk --release` runs plain `assembleRelease` **without** injected signing props. For a shareable signed APK when `android/` already exists, use the Gradle recipe below instead (or ensure signing is configured in Gradle).

To remove a variant: `adb uninstall com.satsigner.satsigner.dev.<segment>`.

---

## Standalone vs. Metro-connected builds

| Build type | Runs standalone? | Notes |
|---|---|---|
| `assembleDebug` | **No** — Expo dev launcher, needs Metro | Dev / hot reload only |
| `assembleRelease` | **Yes** — JS bundled in | Device testing, sharing, sideloading |

---

## Prerequisites

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
echo "sdk.dir=$HOME/Library/Android/sdk" > apps/mobile/android/local.properties
```

`local.properties` is gitignored.

Native folder must exist. Only prebuild when missing or config/plugins changed:

```bash
cd apps/mobile && pnpm run prebuild:dev   # or prebuild:prod
```

---

## Standalone release APK (recommended for device / sharing)

### 1. Throwaway keystore (one-time)

```bash
keytool -genkey -v \
  -keystore apps/mobile/android/debug-release-key.jks \
  -alias satsigner -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Test, OU=Test, O=Test, L=Test, S=Test, C=US" \
  -storepass android -keypass android
```

### 2. Build (signed)

```bash
cd apps/mobile/android
export ANDROID_HOME="$HOME/Library/Android/sdk"
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=$(pwd)/debug-release-key.jks \
  -Pandroid.injected.signing.store.password=android \
  -Pandroid.injected.signing.key.alias=satsigner \
  -Pandroid.injected.signing.key.password=android
```

Gradle needs unrestricted permissions (network + SDK). Allow ~10–20 minutes on a cold build; retries are usually fast (incremental).

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

### 3. Save a shareable copy

```bash
mkdir -p apps/mobile/dist/apks
cp -f apps/mobile/android/app/build/outputs/apk/release/app-release.apk \
  apps/mobile/dist/apks/satsigner-dev-<suffix>-release.apk
# Optional: also copy to Desktop for AirDrop / transfer
```

### 4. Install

```bash
adb devices   # pick serial if multiple
adb -s <serial> install -r path/to.apk
```

Variant package ids look like `com.satsigner.satsigner.dev.feature_payjoin` (branch suffix sanitized).

---

## Debug APK (Metro-connected)

```bash
cd apps/mobile/android && ./gradlew assembleDebug
# then: cd apps/mobile && pnpm start
```

---

## Production release APK

```bash
cd apps/mobile && pnpm run prebuild:prod
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
| JS/TS only | No |
| `app.config.ts` / native plugins | Yes |
| `android/` missing | Yes |
| Rebuild same config | No |

---

## Troubleshooting

**`SDK location not found`** → write `local.properties` (Prerequisites)

**Expo dev launcher instead of app** → used debug; build `assembleRelease`

**Maven / `listenablefuture` read timed out** → retry the same `assembleRelease`; caches usually make it succeed

**`:app:packageRelease` IncrementalSplitter failure** → retry; often succeeds once deps are warm

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE` / signature mismatch** → uninstall then install (debug vs release keystores differ):
```bash
adb -s <serial> uninstall com.satsigner.satsigner.dev.<segment>
adb -s <serial> install path/to.apk
```

**`INSTALL_FAILED_INSUFFICIENT_STORAGE`** → free emulator storage or install on a physical device (`adb devices`)

**Multiple devices** → always pass `-s <serial>`; do not assume the first device

**Gradle `./gradlew: no such file`** → confirm `apps/mobile/android/gradlew` exists (run prebuild if not); use `bash ./gradlew` if needed
