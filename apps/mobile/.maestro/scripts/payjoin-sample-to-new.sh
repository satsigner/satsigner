#!/usr/bin/env bash
# Single-device: receiver wallet gets a Payjoin URI → Sample (segwit) sends to it.
#
# From apps/mobile:
#   pnpm maestro:payjoin:sample-to-new
#   ACCOUNT_NAME=pjre pnpm maestro:payjoin:sample-to-new
#
# Note: receiver polling only runs while Receive is mounted. On one device the
# sender may fall back to a plain broadcast if negotiation times out.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAESTRO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MOBILE_DIR="$(cd "${MAESTRO_DIR}/.." && pwd)"
FLOWS="${MAESTRO_DIR}/flows"
RUN="${SCRIPT_DIR}/run-with-results.sh"
RESULTS="${MAESTRO_DIR}/results"
# Prefer an existing empty receiver. Override to create a new short name:
#   ACCOUNT_NAME=n1234 pnpm maestro:payjoin:sample-to-new
ACCOUNT_NAME="${ACCOUNT_NAME:-pjre}"
SERIAL="${ANDROID_SERIAL:-}"
URI_FILE="${RESULTS}/last-payjoin-uri.txt"

cd "${MOBILE_DIR}"
mkdir -p "${RESULTS}"

function adb_cmd() {
  if [[ -n "${SERIAL}" ]]; then
    adb -s "${SERIAL}" "$@"
  else
    adb "$@"
  fi
}

function extract_capture_line() {
  local file="$1"
  [[ -f "${file}" ]] || return 0
  # Maestro logs: "JsConsole: PAYJOIN_URI_CAPTURE=bitcoin:…?pj=…"
  # Use POSIX classes — macOS BSD grep does not support \S.
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

echo "======== 1/2 receive on wallet (${ACCOUNT_NAME}) ========"
set +e
bash "${RUN}" \
  -e "ACCOUNT_NAME=${ACCOUNT_NAME}" \
  "${FLOWS}/payjoin-receive-new-wallet-signet.yaml"
RECV_STATUS=$?
set -e
URI="$(capture_uri)"
# Strip wrapping quotes if present
URI="${URI#\'}"
URI="${URI%\'}"
URI="${URI#\"}"
URI="${URI%\"}"
echo "Captured PAYJOIN_URI=${URI:-<none>}"
if [[ -n "${URI}" ]]; then
  printf '%s\n' "${URI}" > "${URI_FILE}"
fi

if [[ "${RECV_STATUS}" -ne 0 || -z "${URI}" || "${URI}" != *pj=* ]]; then
  echo "Receive failed or no URI — aborting send."
  exit 1
fi

echo "======== 2/2 send from Sample (segwit) ========"
set +e
bash "${RUN}" \
  -e "PAYJOIN_URI=${URI}" \
  "${FLOWS}/payjoin-send-signet.yaml"
SEND_STATUS=$?
set -e

{
  echo ""
  echo "======== sample-to-new summary ========"
  echo "receiver:  ${ACCOUNT_NAME}  exit ${RECV_STATUS}"
  echo "send:      Sample (segwit)  exit ${SEND_STATUS}"
  echo "PAYJOIN_URI: ${URI}"
} | tee "${RESULTS}/SAMPLE_TO_NEW_SUMMARY.txt"

if [[ "${SEND_STATUS}" -ne 0 ]]; then
  exit 1
fi
exit 0
