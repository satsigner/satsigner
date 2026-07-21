# Maestro — SatSigner UI automation

Local Android Maestro harness for smoke + feature flows. YAML source of truth:
**`apps/mobile/.maestro/`** only.

Agent protocol: see [`AGENT_FEEDBACK.md`](./AGENT_FEEDBACK.md)
(`prep → run → STATUS.json / SUMMARY → patch → re-run`).

Default package id for current native builds:
`com.satsigner.satsigner.dev.feat_bitcoin_core_rpc` (override with `APP_ID`).

## Prerequisites

1. [Maestro CLI](https://maestro.mobile.dev/getting-started/installing-maestro)
2. App built (`pnpm variant` / `expo run:android`)
3. Emulator or device online
4. **Metro** on host `:8081` (`APP_VARIANT=development npx expo start`)
5. Quit **Maestro Studio** before CLI runs (shared Android driver)

### Launch troubleshooting

| Symptom | Fix |
|---|---|
| `Android driver did not start up in time` | Quit Studio; `pnpm maestro:prep`. If still flaky, keep `MAESTRO_REINSTALL_DRIVER=1` (default) |
| Stuck on splash / “Loading from …” | Metro down or missing `adb reverse` — `pnpm maestro:prep` |
| Crash: `App react context shouldn't be created before` | Do not `launchApp` then `openLink` — `shared/launch.yaml` uses `stopApp` + deep link only |
| Stuck on **Open with** | Launch taps **Just once**; keep a single SatSigner package installed |
| Wrong screen / “Add Account” missing | Dirty app state — shared `goto-account-list` resets to Bitcoin list |

## Single YAML tree

| Path | Role |
|---|---|
| `.maestro/flows/` | All flows (edit here) |
| `.maestro/flows/shared/` | Launch, PIN skip, account-list reset |
| Studio | Open `apps/mobile/.maestro` (`pnpm maestro:link-studio`) |

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

Optional Payjoin (signet) suites — product flows, not the runner contract:

```bash
pnpm maestro:payjoin:receive
PAYJOIN_URI='bitcoin:…?pj=…' pnpm maestro:payjoin:send
# or: pnpm maestro:payjoin:send -- -e PAYJOIN_URI='bitcoin:…?pj=…'
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

| File | Contents |
|---|---|
| `STATUS.json` | `{ ok, exitCode, flow, appId, startedAt, endedAt, artifactDir, failureMessage, screenshots[] }` |
| `SUMMARY.txt` | `PASS` only on success; failure digests when `ok=false` |
| `console.log` | Full live tee |
| `failure.png` | Canonical failure screenshot (failures) |
| `report.xml` / `maestro.log` / `commands-*.json` / `*.png` | Maestro debug |

## Flows

| Flow | What it checks |
|---|---|
| `flows/smoke-boot.yaml` | Launch → skip PIN → Bitcoin account list (`Add Account`) |
| `flows/payjoin-*.yaml` | Optional Payjoin receive/send (signet) |

Shared helpers: `launch.yaml`, `skip-pin-and-warning.yaml`, `goto-account-list.yaml`,
`ensure-signet.yaml`, `open-sample-segwit.yaml`, …

## Env

| Var | Description |
|---|---|
| `APP_ID` | Android package (always passed as `-e APP_ID=…`) |
| Any `-e KEY=VALUE` | Generic Maestro env passthrough via the runner |
| `MAESTRO_REINSTALL_DRIVER` | `1` (default) / `0` to skip `--reinstall-driver` |
| `MAESTRO_DRIVER_STARTUP_TIMEOUT` | Driver wait ms (default `120000`) |

## Notes

- English locale strings are assumed.
- Tags `manual` are excluded from workspace suite runs.
- Prefer composing `flows/shared/*` for dirty-state recovery instead of brittle absolute paths.
