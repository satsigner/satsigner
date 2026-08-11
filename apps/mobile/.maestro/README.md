# Maestro — SatSigner UI automation

Local Android Maestro harness for smoke + feature flows. YAML source of truth:
**`apps/mobile/.maestro/`** only.

Agent protocol: see [`AGENT_FEEDBACK.md`](./AGENT_FEEDBACK.md)
(`prep → run → STATUS.json / SUMMARY → patch → re-run`).

Default package id for current native builds:
`com.satsigner.satsigner.dev.feature_payjoin` (override with `APP_ID`).

**Variant package must match the app on the device.** `pnpm variant` installs a
suffix-specific id (e.g. `….feature_payjoin`, `….feat_bitcoin_core_rpc`). Maestro
defaults in `config.yaml` / `run-with-results.sh` must be that same id — otherwise
launch skips the visible UI, cold-starts the wrong package, and flows look “blind”
(Add Account / Sample / Clown never match). Confirm with:

```bash
adb shell dumpsys activity activities | rg 'satsigner\.satsigner\.dev'
# or: adb shell pm list packages | rg satsigner
APP_ID=com.satsigner.satsigner.dev.<your_suffix> pnpm maestro:smoke
```

## Prerequisites

1. [Maestro CLI](https://maestro.mobile.dev/getting-started/installing-maestro)
2. App built (`pnpm variant` / `expo run:android`)
3. Emulator or device online
4. **Metro** on host `:8081` (`APP_VARIANT=development npx expo start`)
5. Quit **Maestro Studio** before CLI runs (shared Android driver)

### Launch troubleshooting

| Symptom                                                | Fix                                                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `Android driver did not start up in time`              | Quit Studio; `pnpm maestro:prep`. If still flaky, keep `MAESTRO_REINSTALL_DRIVER=1` (default)   |
| Stuck on splash / “Loading from …”                     | Metro down or missing `adb reverse` — `pnpm maestro:prep`                                       |
| Crash: `App react context shouldn't be created before` | Do not `launchApp` then `openLink` — `shared/launch.yaml` uses `stopApp` + deep link only       |
| Stuck on **Open with**                                 | Launch taps **Just once**; keep a single SatSigner package installed                            |
| Wrong screen / “Add Account” missing                   | Dirty app state — shared `goto-account-list` resets to Bitcoin list                             |
| Launch never sees Add Account / Sample / Clown         | **Wrong `APP_ID`** — set it to the variant package actually open on the device (see note above) |
| Stuck NotificationShade / empty hierarchy              | Swipe shade closed (or reboot); Maestro can’t see app UI while shade has focus                  |

## Single YAML tree

| Path                     | Role                                                     |
| ------------------------ | -------------------------------------------------------- |
| `.maestro/flows/`        | All flows (edit here)                                    |
| `.maestro/flows/shared/` | Launch, PIN skip, account-list reset                     |
| Studio                   | Open `apps/mobile/.maestro` (`pnpm maestro:link-studio`) |

Do not hand-edit a duplicate Studio copy. Do not symlink under `maestro/`.

## Commands

From `apps/mobile`:

```bash
pnpm maestro:prep
pnpm maestro:smoke          # boot → known account-list screen

# Any flow + generic -e passthrough
bash .maestro/scripts/run-with-results.sh \
  -e KEY=value \
  .maestro/flows/smoke-boot.yaml

pnpm maestro:last           # STATUS / SUMMARY for latest run
pnpm maestro:link-studio    # prints Studio path (.maestro/)
```

Optional Payjoin (signet) suites — product flows, not the runner contract.
**Funded pair:** Clown receives, Sample (segwit) sends — four Maestro steps
(`pnpm maestro:payjoin:sample-to-clown`): receive → send/wait → finish receive →
resume send/broadcast. Empty wallets assert messaging via
`pnpm maestro:payjoin:receive:empty`.

```bash
pnpm maestro:payjoin:receive:clown     # Clown → Waiting for sender + Expiring + PAYJO.IN
pnpm maestro:payjoin:sample-to-clown   # 4-step Sample → Clown roundtrip
PAYJOIN_URI='bitcoin:…?pj=…' pnpm maestro:payjoin:send
pnpm maestro:payjoin:receive:empty     # new empty wallet → empty-wallet messaging
```

Markers: `MAESTRO_RUN_START` … `MAESTRO_EXIT=<code>` … `MAESTRO_RUN_END`.

While a flow runs, Maestro suite mode only prints `Waiting for flows to complete…`
on stdout. The runner streams step lines from `maestro.log` as
`[RUNNING]` / `[COMPLETED]` / `[FAILED]` (disable with `MAESTRO_LIVE_LOG=0`).

### Driver reinstall

`MAESTRO_REINSTALL_DRIVER` defaults to `1` (`--reinstall-driver` each run).
Set `MAESTRO_REINSTALL_DRIVER=0` for faster iteration when the driver is healthy.
Flakes after Studio / `DELETE_FAILED_INTERNAL_ERROR` → leave default on, or re-run
`pnpm maestro:prep`.

## Artifacts

Every `run-with-results` run writes **`apps/mobile/.maestro/results/latest/`**:

| File                                                       | Contents                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `STATUS.json`                                              | `{ ok, exitCode, flow, appId, startedAt, endedAt, artifactDir, failureMessage, screenshots[] }` |
| `SUMMARY.txt`                                              | `PASS` only on success; failure digests when `ok=false`                                         |
| `console.log`                                              | Full live tee                                                                                   |
| `failure.png`                                              | Canonical failure screenshot (failures)                                                         |
| `report.xml` / `maestro.log` / `commands-*.json` / `*.png` | Maestro debug                                                                                   |

## Flows

| Flow                                             | What it checks                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `flows/smoke-boot.yaml`                          | Launch → skip PIN → Bitcoin account list (`Add Account`)               |
| `flows/payjoin-receive-clown-signet.yaml`        | Funded **Clown** receive → waiting + expiring + `PAYJO.IN`             |
| `flows/payjoin-receive-signet.yaml`              | Funded Sample receive (solo / debug)                                   |
| `flows/payjoin-receive-empty-wallet-signet.yaml` | New empty wallet → empty-wallet messaging, no session                  |
| `flows/payjoin-receive-new-wallet-signet.yaml`   | Named account: empty messaging **or** active session if funded         |
| `flows/payjoin-send-signet.yaml`                 | **Sample** pastes URI → sign → **Waiting for receiver** (or broadcast) |
| `flows/payjoin-clown-finish-receive.yaml`        | Re-open Clown → poll/finalize → **Payjoin complete**                   |
| `flows/payjoin-sample-resume-send.yaml`          | Sample session card → Check response → broadcast                       |
| `flows/payjoin-roundtrip-signet.yaml`            | Manual two-device marker                                               |

Shared helpers: `launch.yaml`, `skip-pin-and-warning.yaml`, `goto-account-list.yaml`,
`ensure-signet.yaml`, `open-sample-segwit.yaml`, …

## Env

| Var                              | Description                                      |
| -------------------------------- | ------------------------------------------------ |
| `APP_ID`                         | Android package (always passed as `-e APP_ID=…`) |
| Any `-e KEY=VALUE`               | Generic Maestro env passthrough via the runner   |
| `MAESTRO_REINSTALL_DRIVER`       | `1` (default) / `0` to skip `--reinstall-driver` |
| `MAESTRO_DRIVER_STARTUP_TIMEOUT` | Driver wait ms (default `120000`)                |

## Notes

- English locale strings are assumed.
- Tags `manual` are excluded from workspace suite runs.
- Prefer composing `flows/shared/*` for dirty-state recovery instead of brittle absolute paths.
