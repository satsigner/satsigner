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

**Build and publish.** Builds one of three identities and publishes that APK to Zapstore: the current branch, generic dev (no branch suffix), or production (clean name). The notes field is the announcement text. This uses `apps/mobile/scripts/publish-zapstore.mjs`. Listing and release-post management stays behind **Manage listings and posts**.

**Build APK.** Two choices, then one build. A clean prebuild deletes `apps/mobile/android`. The file is saved under `apps/mobile/dist/apks`.

| Choice | Options |
| --- | --- |
| Name and package id | Branch, production, or generic dev |
| APK type | All CPUs, or Pixel 8, 9, or 10 (`arm64-v8a` only) |

**Build and publish** uses the same three identities. Production stays blocked until a release keystore is configured.

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
