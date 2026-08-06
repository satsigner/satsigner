#!/usr/bin/env bash
# Run a Maestro flow with live terminal output + durable artifacts for agents.
#
# From apps/mobile:
#   bash .maestro/scripts/run-with-results.sh .maestro/flows/smoke-boot.yaml
#   bash .maestro/scripts/run-with-results.sh -e FOO=bar .maestro/flows/….yaml
#
# Live: stdout/stderr stream in the terminal (and tee → console.log).
# Suite mode only prints "Waiting for flows…" — we also stream step lines from
# maestro.log (MAESTRO_LIVE_LOG=0 to disable).
# After: .maestro/results/latest/{STATUS.json,SUMMARY.txt,console.log,report.xml,…}
#
# MAESTRO_REINSTALL_DRIVER=1 (default) reinstalls the Android driver each run.
# Set to 0 to skip (faster when the driver is already healthy).
#
# APP_ID must match the variant package on the device (pnpm variant suffix).
# Wrong id → Maestro attaches to another install and never sees Add Account /
# Sample / Clown on the screen you are looking at.
set -euo pipefail

export PATH="${HOME}/.maestro/bin:${PATH}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-120000}"
export MAESTRO_CLI_NO_ANALYTICS="${MAESTRO_CLI_NO_ANALYTICS:-1}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAESTRO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MOBILE_DIR="$(cd "${MAESTRO_DIR}/.." && pwd)"
RESULTS_DIR="${MAESTRO_DIR}/results/latest"
CONSOLE_LOG="${RESULTS_DIR}/console.log"
MAESTRO_LOG="${RESULTS_DIR}/maestro.log"
APP_ID="${APP_ID:-com.satsigner.satsigner.dev.feature_payjoin}"

cd "${MOBILE_DIR}"
bash "${SCRIPT_DIR}/prep-android.sh"

: > "${HOME}/.maestro/sessions" 2>/dev/null || true

rm -rf "${RESULTS_DIR}"
mkdir -p "${RESULTS_DIR}"
# So tail -F can attach before Maestro creates the file
: > "${MAESTRO_LOG}"

FLOW=""
EXTRA=()
for arg in "$@"; do
  case "${arg}" in
    *.yaml|*.yml)
      FLOW="${arg}"
      ;;
    *)
      if [[ -d "${arg}" ]]; then
        FLOW="${arg}"
      elif [[ -d "${MOBILE_DIR}/${arg}" ]]; then
        FLOW="${MOBILE_DIR}/${arg}"
      else
        EXTRA+=("${arg}")
      fi
      ;;
  esac
done

if [[ -z "${FLOW}" ]]; then
  echo "Usage: $0 [-e KEY=VALUE …] <flow.yaml|workspace-dir>" >&2
  exit 2
fi

# Resolve relative flow paths from apps/mobile
if [[ "${FLOW}" != /* ]]; then
  FLOW="${MOBILE_DIR}/${FLOW}"
fi

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo "MAESTRO_RUN_START ${STARTED_AT}"
  echo "Flow: ${FLOW}"
  echo "APP_ID: ${APP_ID}"
  echo "Artifacts: ${RESULTS_DIR}"
  echo "----"
} | tee "${CONSOLE_LOG}"

RUNNER=(maestro)
if command -v stdbuf >/dev/null 2>&1; then
  RUNNER=(stdbuf -oL -eL maestro)
fi

REINSTALL_ARGS=()
if [[ "${MAESTRO_REINSTALL_DRIVER:-1}" != "0" ]]; then
  REINSTALL_ARGS=(--reinstall-driver)
fi

# With multiple adb devices, Maestro may pick the wrong one (e.g. a locked
# phone). Pin the target when ANDROID_SERIAL is set.
DEVICE_ARGS=()
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  DEVICE_ARGS=(--device "${ANDROID_SERIAL}")
  echo "DEVICE: ${ANDROID_SERIAL}" | tee -a "${CONSOLE_LOG}"
fi

LIVE_PID=""
LIVE_STOP="${RESULTS_DIR}/.live-log-stop"
function stop_live_log() {
  if [[ -z "${LIVE_PID}" ]]; then
    return
  fi
  touch "${LIVE_STOP}" 2>/dev/null || true
  # Poller exits on sentinel; don't block forever if it doesn't
  local i=0
  while kill -0 "${LIVE_PID}" 2>/dev/null && [[ "${i}" -lt 30 ]]; do
    sleep 0.1
    i=$((i + 1))
  done
  if kill -0 "${LIVE_PID}" 2>/dev/null; then
    kill "${LIVE_PID}" 2>/dev/null || true
    sleep 0.1
    kill -9 "${LIVE_PID}" 2>/dev/null || true
  fi
  # Belt-and-suspenders: orphaned poller (LIVE_PID is often `tee`)
  pkill -f "stream-maestro-log.py ${MAESTRO_LOG}" 2>/dev/null || true
  wait "${LIVE_PID}" 2>/dev/null || true
  LIVE_PID=""
}
trap stop_live_log EXIT

# Suite mode (--format junit) only prints "Waiting for flows to complete…" on
# stdout. Step RUNNING/COMPLETED/FAILED lines go to maestro.log — mirror them.
# Use a polling reader (not tail -F) so we don't hold maestro.log open and
# block Maestro's shutdown after Passed/Failed.
if [[ "${MAESTRO_LIVE_LOG:-1}" != "0" ]]; then
  {
    echo "MAESTRO_LIVE_LOG=1 (step stream from maestro.log)"
    echo "---- steps ----"
  } | tee -a "${CONSOLE_LOG}"

  rm -f "${LIVE_STOP}"
  python3 -u "${SCRIPT_DIR}/stream-maestro-log.py" \
    "${MAESTRO_LOG}" \
    "${LIVE_STOP}" \
    2>/dev/null \
    | tee -a "${CONSOLE_LOG}" &
  LIVE_PID=$!
fi

set +e
"${RUNNER[@]}" test \
  --no-ansi \
  ${DEVICE_ARGS[@]+"${DEVICE_ARGS[@]}"} \
  ${REINSTALL_ARGS[@]+"${REINSTALL_ARGS[@]}"} \
  -e "APP_ID=${APP_ID}" \
  ${EXTRA[@]+"${EXTRA[@]}"} \
  --debug-output "${RESULTS_DIR}" \
  --test-output-dir "${RESULTS_DIR}" \
  --flatten-debug-output \
  --format junit \
  --output "${RESULTS_DIR}/report.xml" \
  "${FLOW}" 2>&1 | tee -a "${CONSOLE_LOG}"
STATUS=${PIPESTATUS[0]}
set -e

stop_live_log
trap - EXIT

ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

{
  echo "----"
  echo "MAESTRO_EXIT=${STATUS}"
  echo "MAESTRO_RUN_END ${ENDED_AT}"
} | tee -a "${CONSOLE_LOG}"

bash "${SCRIPT_DIR}/write-run-status.sh" \
  "${RESULTS_DIR}" \
  "${STATUS}" \
  "${FLOW}" \
  "${APP_ID}" \
  "${STARTED_AT}" \
  "${ENDED_AT}" \
  >/dev/null

bash "${SCRIPT_DIR}/last-failure.sh" "${STATUS}" \
  | tee "${RESULTS_DIR}/SUMMARY.txt" \
  | tee -a "${CONSOLE_LOG}"

exit "${STATUS}"
