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
| Production        | Production package id, no branch suffix                      |
| Pixel 8, 9, or 10 | `arm64-v8a` only                                             |

## Tools the actions expect

| Action            | Needs                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Sign in           | A NIP-07 extension in the browser                                                                        |
| Sync with ngit    | `ngit` on `PATH`                                                                                         |
| Build APK         | Android SDK at `ANDROID_HOME`, or `~/Library/Android/sdk` on macOS. `pnpm` can run `apps/mobile` scripts |
| Build and publish | The APK tools above, plus `zsp` (`~/go/bin/zsp` unless `ZSP_BIN` is set)                                 |

## Tests

```bash
pnpm --dir tools/release test
```
