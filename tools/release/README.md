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

**Build and publish.** Rebuilds the current Android release APK and publishes that file to Zapstore. The notes field is the announcement text. This uses `apps/mobile/scripts/publish-zapstore.mjs`. Listing and release-post management stays behind **Manage listings and posts**.

**Build APK.** Saves a copy under `apps/mobile/dist/apks`. Each option runs a clean prebuild, which deletes `apps/mobile/android`.

| Option            | What it builds                                               |
| ----------------- | ------------------------------------------------------------ |
| Branch            | Dev package id for the current branch, all CPU architectures |
| Production        | Production package id, no branch suffix, ARM CPUs only       |
| Pixel 8, 9, or 10 | `arm64-v8a` only                                             |

## Tools the actions expect

| Action            | Needs                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Sign in           | A NIP-07 extension in the browser                                                                        |
| Sync with ngit    | `ngit` on `PATH`                                                                                         |
| Build APK         | Android SDK at `ANDROID_HOME`, or `~/Library/Android/sdk` on macOS. `pnpm` can run `apps/mobile` scripts |
| Build and publish | The APK tools above, plus `zsp` (`~/go/bin/zsp` unless `ZSP_BIN` is set), plus a release keystore        |

## Android release key

Zapstore rejects APKs signed with the public debug keystore. Create a key once. The 12 words rebuild the same keystore. They are not your Nostr key.

```bash
pnpm --dir tools/release keystore
```

Write the words down, then publish again from the release page. To check a written phrase against the keystore already on this machine:

```bash
pnpm --dir tools/release keystore:confirm
```

### Sign on another computer

The 12 words rebuild the same key and the same certificate, byte for byte, so releases from the new computer update the installed app.

1. Install the tools from [Tools the actions expect](#tools-the-actions-expect), plus OpenSSL 3 (`brew install openssl` on macOS; the system LibreSSL is not tested).
2. Clone the repository and run `pnpm install` at its root.
3. Rebuild the keystore and type the 12 words when asked:

   ```bash
   pnpm --dir tools/release keystore:restore
   ```

   This writes `~/.satsigner/release.p12` and `~/.satsigner/release.pass`. If a keystore is already there, add `--force` to replace it.

4. Check the printed `Certificate SHA-256`. For the current Satsigner release key it is `E0:D6:E6:92:FA:D1:AA:16:26:FF:54:9A:CE:E3:47:C2:EB:CE:8B:E5:0D:07:44:CB:D0:D3:A6:75:39:F2:7E:D7`. A different value means a word is wrong: Android and Zapstore treat it as another developer.
5. Start the console with `pnpm --dir tools/release dev` and sign in with the same npub as before.
6. Publish. The publisher finds the identity proof that links this certificate to your npub. It signs a new one only when none is active or it expires within 30 days.

Type the words only into the restore prompt. Never save them in a file, a chat or the repository.

## Tests

```bash
pnpm --dir tools/release test
```
