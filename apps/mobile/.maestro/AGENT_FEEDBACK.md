# Maestro agent feedback loop

Protocol for fixing UI regressions with SatSigner’s local Maestro harness.
No Maestro Studio required for the diagnose → patch → re-run cycle.

## Single source of truth

Edit YAML only under `apps/mobile/.maestro/`.

- CLI: `pnpm maestro:*` (paths under `.maestro/flows/`)
- Studio: open `apps/mobile/.maestro` directly (`pnpm maestro:link-studio` prints the path)

Do not maintain a second copy of flows by hand. Do not symlink
`maestro/satsigner-workspace` → `.maestro` (Metro crashes on that).

## Loop

```text
prep → run → read STATUS.json / SUMMARY.txt / failure.png → patch → re-run
```

### 1. Prep

From `apps/mobile`:

```bash
pnpm maestro:prep
```

Ensures `adb reverse` for Metro `:8081`, Metro reachability check, and clears
stale Maestro session locks. Quit **Maestro Studio** first (CLI and Studio share
the Android driver).

**Check `APP_ID` matches the variant on the device** before running (see
`.maestro/README.md`). A mismatch cold-starts the wrong package and skips the
account-list fast path.

### 2. Run

Default smoke (no payjoin):

```bash
pnpm maestro:smoke
```

Arbitrary flow + env passthrough (`-e KEY=VALUE` only — no product-specific
runner contract):

```bash
bash .maestro/scripts/run-with-results.sh \
  -e SOME_KEY=value \
  .maestro/flows/smoke-boot.yaml
```

Live step log streams in the terminal. Markers:
`MAESTRO_RUN_START` … `MAESTRO_EXIT=<code>` … `MAESTRO_RUN_END`.

Driver flakes: `MAESTRO_REINSTALL_DRIVER=1` (default) passes
`--reinstall-driver`. Set `MAESTRO_REINSTALL_DRIVER=0` to skip when healthy.

### 3. Read artifacts

Every run writes `apps/mobile/.maestro/results/latest/`:

| File                                             | Purpose                                                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `STATUS.json`                                    | Machine contract: `ok`, `exitCode`, `flow`, `appId`, `startedAt`, `endedAt`, `artifactDir`, `failureMessage`, `screenshots[]` |
| `SUMMARY.txt`                                    | Human/agent digest — **PASS-only** on success; failure sections only when `ok=false`                                          |
| `console.log`                                    | Full live tee                                                                                                                 |
| `failure.png`                                    | Canonical failure screenshot (on fail)                                                                                        |
| `report.xml` / `maestro.log` / `commands-*.json` | Maestro debug                                                                                                                 |

On failure, diagnose from:

1. `STATUS.json` → `failureMessage`, `ok: false`
2. `SUMMARY.txt` → JUnit / failed commands
3. `failure.png` → UI at failure

```bash
pnpm maestro:last          # same as SUMMARY for latest
cat .maestro/results/latest/STATUS.json
```

### 4. Patch

Change app UI / shared helpers under `.maestro/flows/shared/` as needed.
Keep Expo launch rule: `stopApp` + deep link only — never `launchApp` then
`openLink`.

### 5. Re-run

```bash
pnpm maestro:prep   # if Metro/adb look wrong
pnpm maestro:smoke  # or the failing flow
```

Stop when `STATUS.json` has `"ok": true` and `SUMMARY.txt` starts with `PASS`.

## Commands cheat sheet

| Command                    | Role                                                            |
| -------------------------- | --------------------------------------------------------------- |
| `pnpm maestro:prep`        | Device + Metro prep                                             |
| `pnpm maestro:smoke`       | Non-payjoin boot → account list                                 |
| `pnpm maestro:last`        | Print latest SUMMARY                                            |
| `pnpm maestro:link-studio` | Print Studio path (open `.maestro/`)                            |
| `pnpm maestro:sync`        | Copy newest Studio `~/.maestro/tests` run into `results/latest` |

Payjoin flows (`pnpm maestro:payjoin:*`) are optional product suites on top of
this harness; they do not define the runner contract.
