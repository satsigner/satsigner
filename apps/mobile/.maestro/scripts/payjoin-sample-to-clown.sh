#!/usr/bin/env bash
# Single-device Payjoin between the two funded signet wallets:
#   Receiver: Clown  (seed below / CLOWN_MNEMONIC)
#   Sender:   Sample (segwit)
#
# Matches device logs / live rust roundtrip sample → clown:
#   1) Clown receive → mailbox ready + copy pj= URI
#   2) Sample send → post original → "Waiting for receiver"
#   3) Clown receive again → poll proposal → finalize → "Payjoin complete"
#   4) Sample account session card → Check for Payjoin response → broadcast
#
# From apps/mobile:
#   pnpm maestro:payjoin:sample-to-clown
#   # alias kept: pnpm maestro:payjoin:sample-to-new
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAESTRO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MOBILE_DIR="$(cd "${MAESTRO_DIR}/.." && pwd)"
FLOWS="${MAESTRO_DIR}/flows"
RUN="${SCRIPT_DIR}/run-with-results.sh"
RESULTS="${MAESTRO_DIR}/results"
SERIAL="${ANDROID_SERIAL:-}"
URI_FILE="${RESULTS}/last-payjoin-uri.txt"

# Same seed as packages/react-native-payjoin/rust/tests/live_signet_roundtrip.rs
CLOWN_ACCOUNT_NAME="${CLOWN_ACCOUNT_NAME:-Clown}"
CLOWN_MNEMONIC="${CLOWN_MNEMONIC:-clown believe select betray misery shine bone coyote benefit evoke auction hybrid famous equip know embark will alter mushroom beauty creek online announce hidden}"

cd "${MOBILE_DIR}"
mkdir -p "${RESULTS}"

function adb_cmd() {
  if [[ -n "${SERIAL}" ]]; then
    adb -s "${SERIAL}" "$@"
  else
    adb "$@"
  fi
}

function set_device_clipboard() {
  local text="$1"
  # Best-effort: import screen auto-pastes / Paste button reads clipboard.
  adb_cmd shell "cmd clipboard set-text $(printf '%q' "${text}")" >/dev/null 2>&1 \
    || adb_cmd shell "am broadcast -a clipper.set -e text $(printf '%q' "${text}")" >/dev/null 2>&1 \
    || true
}

function extract_capture_line() {
  local file="$1"
  [[ -f "${file}" ]] || return 0
  grep -oE 'PAYJOIN_URI_CAPTURE=[^[:space:]]+' "${file}" 2>/dev/null \
    | tail -1 \
    | sed 's/^PAYJOIN_URI_CAPTURE=//' || true
}

function capture_uri() {
  local uri=""
  uri="$(adb_cmd shell 'cmd clipboard get-clip' 2>/dev/null | tr -d '\r' || true)"
  if [[ "${uri}" == *pj=* && "${uri}" == *bitcoin* ]]; then
    echo "${uri}"
    return
  fi
  uri="$(extract_capture_line "${RESULTS}/latest/maestro.log")"
  if [[ -z "${uri}" || "${uri}" != *pj=* ]]; then
    uri="$(extract_capture_line "${RESULTS}/latest/console.log")"
  fi
  if [[ -z "${uri}" || "${uri}" != *pj=* ]]; then
    uri="$(
      grep -oE 'bitcoin:[^[:space:]]+pj=[^[:space:]]+' \
        "${RESULTS}/latest/maestro.log" 2>/dev/null | tail -1 || true
    )"
  fi
  echo "${uri}"
}

echo "======== 1/4 receive on ${CLOWN_ACCOUNT_NAME} ========"
set_device_clipboard "${CLOWN_MNEMONIC}"
set +e
bash "${RUN}" \
  -e "CLOWN_ACCOUNT_NAME=${CLOWN_ACCOUNT_NAME}" \
  -e "CLOWN_MNEMONIC=${CLOWN_MNEMONIC}" \
  "${FLOWS}/payjoin-receive-clown-signet.yaml"
RECV_STATUS=$?
set -e
URI="$(capture_uri)"
URI="${URI#\'}"
URI="${URI%\'}"
URI="${URI#\"}"
URI="${URI%\"}"
echo "Captured PAYJOIN_URI=${URI:-<none>}"
if [[ -n "${URI}" ]]; then
  printf '%s\n' "${URI}" > "${URI_FILE}"
fi

if [[ "${RECV_STATUS}" -ne 0 || -z "${URI}" || "${URI}" != *pj=* ]]; then
  echo "Clown receive failed or no URI — aborting send."
  echo "Tip: Clown must be funded (≥1000 sats) to contribute to Payjoin."
  exit 1
fi

echo "======== 2/4 send from Sample (segwit) → post original ========"
set +e
bash "${RUN}" \
  -e "PAYJOIN_URI=${URI}" \
  "${FLOWS}/payjoin-send-signet.yaml"
SEND_STATUS=$?
set -e

if [[ "${SEND_STATUS}" -ne 0 ]]; then
  echo "Sample send failed — aborting finish/resume."
  exit 1
fi

echo "======== 3/4 finish receive on ${CLOWN_ACCOUNT_NAME} ========"
set +e
bash "${RUN}" \
  -e "CLOWN_ACCOUNT_NAME=${CLOWN_ACCOUNT_NAME}" \
  "${FLOWS}/payjoin-clown-finish-receive.yaml"
FINISH_STATUS=$?
set -e

if [[ "${FINISH_STATUS}" -ne 0 ]]; then
  echo "Clown finish-receive failed — sender may still be waiting."
  exit 1
fi

echo "======== 4/4 resume Sample → check response → broadcast ========"
set +e
bash "${RUN}" \
  "${FLOWS}/payjoin-sample-resume-send.yaml"
RESUME_STATUS=$?
set -e

{
  echo ""
  echo "======== sample-to-clown summary ========"
  echo "1 receive:   ${CLOWN_ACCOUNT_NAME}  exit ${RECV_STATUS}"
  echo "2 send:      Sample (segwit)  exit ${SEND_STATUS}"
  echo "3 finish:    ${CLOWN_ACCOUNT_NAME}  exit ${FINISH_STATUS}"
  echo "4 resume:    Sample (segwit)  exit ${RESUME_STATUS}"
  echo "PAYJOIN_URI: ${URI}"
} | tee "${RESULTS}/SAMPLE_TO_CLOWN_SUMMARY.txt"

if [[ "${RESUME_STATUS}" -ne 0 ]]; then
  exit 1
fi
exit 0
