# Satsigner release console

Local page for publishing this repo over Nostr, building APKs, and sending a release to Zapstore. It listens only on `127.0.0.1`. The Nostr key stays in a NIP-07 browser extension. The page signs through a local bunker bridge.

## Run

From the repo root:

```bash
pnpm --dir tools/release install
pnpm --dir tools/release dev
```

Open http://127.0.0.1:4717 and sign in with a NIP-07 extension (for example Alby or nos2x).

The signer relay uses port `4718`. Stop anything else bound to `4717` or `4718` before starting.

## What the tabs do

**Sync with ngit.** If `origin` is not a `nostr://` remote yet, this publishes the repository with `ngit`, then pushes the current branch. If it is already a Nostr remote, the tab only syncs the branch.

**Build and publish.** Rebuilds the current Android release APK and publishes that file to Zapstore. The notes field is the announcement text. This uses `apps/mobile/scripts/publish-zapstore.mjs`. The listing summary and description come from `apps/mobile/zapstore/summary.txt` and `description.md`, and the screenshots come from `apps/mobile/zapstore/screenshots/` in file-name order. Each publish sends all of them. Listing management stays behind **Manage listings**.

**Preview release.** Shows the listing exactly as a publish sends it: the app name, the summary, the description and every screenshot, in upload order. It then inspects the newest release APK for the chosen channel in `apps/mobile/dist/apks` (the Android SDK's `aapt2` and `apksigner`), compares it with the latest release on `wss://relay.zapstore.dev`, and lists each check:

| Group                    | Checks                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zapstore checks          | What the [Zapstore relay checks](https://zapstore.dev/help/publish) when it reads the APK: a complete `arm64-v8a` build, a version code higher than the published one, a certificate that is the app's current one or linked to it by lineage. Also: the package id, not the debug key, the Satsigner release key, and a listing with a summary, a description and screenshots |
| Permissions and trackers | Camera, photos and files (gallery), microphone, location, contacts and SMS, overlays and other apps, advertising and install tracking. Each requested permission is listed with its API cap. Tracker libraries are found by the Exodus Privacy class signatures in the APK's dex files                                                                                         |

**OK** passed, **FAIL** means the relay or the phone will reject the release, **CHECK** means a permission or library is present and should be expected. Zapstore does not document a malware or permission scan of its own. The permissions and trackers group is what users see on the app page and what scanners such as Exodus report.

**Android permissions.** `apps/mobile/constants/androidPermissions.cjs` lists the only permissions a release may request, and the ones stripped from libraries. The same check runs at two points:

- **Before the build:** `pnpm --dir tools/release permissions:check` reads the `AndroidManifest.xml` of every native dependency in `apps/mobile/package.json` and fails on a permission that is neither allowed nor blocked. Maven libraries (androidx, media3, react-android) only show up after the build.
- **After the build:** `pnpm --dir tools/release permissions:check path/to/app.apk` reads the merged permissions with `aapt2`. Every release APK build (Build APK, `variant --apk --release`) and every publish runs this check and stops if the APK requests anything off the allow list, blocked ones included.

The Preview release tab shows both lists.

**Build APK.** Saves a copy under `apps/mobile/dist/apks`. Each option runs a clean prebuild, which deletes `apps/mobile/android`.

| Option            | What it builds                                               |
| ----------------- | ------------------------------------------------------------ |
| Branch            | Dev package id for the current branch, all CPU architectures |
| Production        | Production package id, no branch suffix, ARM CPUs only       |
| Pixel 8, 9, or 10 | `arm64-v8a` only                                             |

**Version.** Shows the app version from `apps/mobile/package.json`, its Android version code, whether `CHANGELOG.md` has a section for it, and the version in the root, mobile and docs `package.json` and `app.config.ts`, flagging any that differ. Bump them by hand. The console's own version in `tools/release/package.json` is separate.

**Announcements.** Lists your release announcements (notes tagged `#release`) and your latest 20 notes of any kind from the announcement relays. **Delete** or **Delete all** signs one NIP-09 deletion request for the chosen posts. Relays and clients that honour it hide the notes; copies on other relays may stay.

**Cancel.** While a command runs, the header shows it with a **Cancel** button. Cancel stops the command and everything it started, such as `pnpm` and `gradlew`, so a half-done build is thrown away. Sign in stays available during a run, because a publish may be waiting for a signature.

## Tools the actions expect

| Action            | Needs                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Sign in           | A NIP-07 extension in the browser                                                                        |
| Sync with ngit    | `ngit` on `PATH`                                                                                         |
| Build APK         | Android SDK at `ANDROID_HOME`, or `~/Library/Android/sdk` on macOS. `pnpm` can run `apps/mobile` scripts |
| Build and publish | The APK tools above, plus `zsp` (`~/go/bin/zsp` unless `ZSP_BIN` is set), plus a release keystore        |
| Preview release   | The SDK's build-tools (`aapt2`, `apksigner`) and `unzip` on `PATH`                                       |

## Android developer keys

The **Android developer keys** tab shows the keystore on this computer, its certificate SHA-256, whether it is the Satsigner release certificate, any rotated key, and whether `apksigner` is installed. The same report is available in a terminal:

```bash
pnpm --dir tools/release keystore:status
```

The 12 words are only ever typed into a terminal prompt, never into the page.

### Create the release key

Zapstore rejects APKs signed with the public debug keystore. Create a key once. The 12 words rebuild the same keystore. They are not your Nostr key.

```bash
pnpm --dir tools/release keystore
```

> [!WARNING]
> The 12 words are the only backup of the Android release key. Treat them like a wallet seed.
>
> - **Lost** along with the keystore in `~/.satsigner`: no one can sign updates for apps signed with this key again. Android refuses an update signed with another key, so every user must uninstall and reinstall, which deletes the app's data, including wallets that are not backed up. On Zapstore the app starts over under a new certificate.
> - **Leaked:** anyone holding them can sign updates that phones install as genuine Satsigner releases. Rotate the key (below).

### Check the 12 words

```bash
pnpm --dir tools/release keystore:confirm          # the release key
pnpm --dir tools/release keystore:confirm --next   # a rotated key
```

The command prints the keystore's certificate SHA-256, then reads the words without echoing them. It tells apart words that are not 12 valid BIP-39 words (a typo) from valid words that do not rebuild this keystore (another phrase).

### Sign on another computer

The 12 words rebuild the same key and the same certificate, byte for byte, so releases from the new computer update the installed app.

1. Install the tools from [Tools the actions expect](#tools-the-actions-expect), plus OpenSSL 3 (`brew install openssl` on macOS; the system LibreSSL is not tested).
2. Clone the repository and run `pnpm install` at its root.
3. Rebuild the keystore and type the 12 words when asked:

   ```bash
   pnpm --dir tools/release keystore:restore
   ```

   This writes `~/.satsigner/release.p12` and `~/.satsigner/release.pass`. If a keystore is already there, add `--force` to replace it.

4. Check the printed `Certificate SHA-256`. For the current Satsigner release key it is `E0:D6:E6:92:FA:D1:AA:16:26:FF:54:9A:CE:E3:47:C2:EB:CE:8B:E5:0D:07:44:CB:D0:D3:A6:75:39:F2:7E:D7`. A different value means a word is wrong: Android and Zapstore treat it as another developer. `keystore:status` and the keys tab compare it for you.
5. If the key was rotated, restore the new key too: `pnpm --dir tools/release keystore:rotate --restore`, then type its 12 words.
6. Start the console with `pnpm --dir tools/release dev` and sign in with the same npub as before.
7. Publish. The publisher finds the identity proof that links this certificate to your npub. It signs a new one only when none is active or it expires within 30 days.

Type the words only into the restore prompt. Never save them in a file, a chat or the repository.

### Rotate the signing key

Rotate only when the key leaked or must be retired. Following [Zapstore's guidance](https://zapstore.dev/help/publish#if-your-signing-key-changes): Android accepts an update signed with a new certificate only when the new certificate carries a signing lineage (APK Signature Scheme v3) back to the old one, and the Zapstore relay rejects a release whose certificate is neither the app's current one nor linked to it by lineage.

1. Confirm the current words with `keystore:confirm`. Rotation needs the old key.
2. Start the rotation:

   ```bash
   pnpm --dir tools/release keystore:rotate
   ```

   This writes the new key to `~/.satsigner/next/`, has `apksigner rotate` sign the lineage with the old key into `~/.satsigner/release.lineage`, and prints 12 new words. Back them up like the first ones. Pass `--force` to replace an earlier rotated key.

3. From then on every release build (Build APK and Build and publish) is re-signed with `apksigner sign --next-signer --lineage`. Android 13 and later verify the new key through v3.1. Older versions keep verifying the old key, so the old key keeps signing every release. Never delete it or its words.
4. Publish once. The publisher links the **new** certificate to your npub with a fresh NIP-C1 identity proof (`zsp identity --link-key`), so Zapstore accepts it as the app's certificate.

The lineage is not secret and is rebuilt from both keys, so a second computer needs only the two sets of words. `expo run:android --variant release` installs straight from Gradle and is not re-signed; use Build APK when testing an update over a rotated install.

## Tests

```bash
pnpm --dir tools/release test
```
