#!/usr/bin/env bash
# Run smoke + optional payjoin suite using .maestro/flows only.
# Usage (from apps/mobile): pnpm maestro:all
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAESTRO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MOBILE_DIR="$(cd "${MAESTRO_DIR}/.." && pwd)"
RESULTS="${MAESTRO_DIR}/results"
FLOWS="${MAESTRO_DIR}/flows"
RUN="${SCRIPT_DIR}/run-with-results.sh"

cd "${MOBILE_DIR}"
mkdir -p "${RESULTS}"

function capture_uri() {
  local uri=""
  if [[ -f "${RESULTS}/latest/console.log" ]]; then
    uri="$(rg -oN 'PAYJOIN_URI_CAPTURE=\S+' "${RESULTS}/latest/console.log" 2>/dev/null | tail -1 | sed 's/^PAYJOIN_URI_CAPTURE=//' || true)"
  fi
  if [[ -z "${uri}" && -f "${RESULTS}/latest/console.log" ]]; then
    uri="$(rg -oN 'bitcoin:[^\s"'\''<>]+pj=[^\s"'\''<>]+' "${RESULTS}/latest/console.log" 2>/dev/null | head -1 || true)"
  fi
  if [[ -z "${uri}" && -f "${RESULTS}/latest/maestro.log" ]]; then
    uri="$(rg -oN 'PAYJOIN_URI_CAPTURE=\S+|bitcoin:[^\s"'\''<>]+pj=[^\s"'\''<>]+' "${RESULTS}/latest/maestro.log" 2>/dev/null | tail -1 | sed 's/^PAYJOIN_URI_CAPTURE=//' || true)"
  fi
  echo "${uri}"
}

echo "======== 0/3 smoke-boot ========"
set +e
bash "${RUN}" "${FLOWS}/smoke-boot.yaml"
SMOKE_STATUS=$?
set -e

echo "======== 1/3 payjoin-receive-signet ========"
set +e
bash "${RUN}" "${FLOWS}/payjoin-receive-signet.yaml"
RECEIVE_STATUS=$?
set -e
URI="$(capture_uri)"
echo "Captured PAYJOIN_URI=${URI:-<none>}"

echo "======== 2/3 payjoin-receive-fresh-signet ========"
set +e
bash "${RUN}" "${FLOWS}/payjoin-receive-fresh-signet.yaml"
FRESH_STATUS=$?
set -e
if [[ -z "${URI}" ]]; then
  URI="$(capture_uri)"
fi
echo "Captured PAYJOIN_URI=${URI:-<none>}"

echo "======== 3/3 payjoin-send-signet ========"
SEND_STATUS=0
if [[ -n "${URI}" ]]; then
  set +e
  bash "${RUN}" -e "PAYJOIN_URI=${URI}" "${FLOWS}/payjoin-send-signet.yaml"
  SEND_STATUS=$?
  set -e
else
  echo "SKIP send: no PAYJOIN_URI captured from receive"
  SEND_STATUS=2
fi

{
  echo ""
  echo "======== maestro:all summary ========"
  echo "smoke:         exit ${SMOKE_STATUS}"
  echo "receive:       exit ${RECEIVE_STATUS}"
  echo "receive-fresh: exit ${FRESH_STATUS}"
  echo "send:          exit ${SEND_STATUS}"
  echo "PAYJOIN_URI:   ${URI:-<none>}"
} | tee "${RESULTS}/ALL_SUMMARY.txt"

if [[ "${SMOKE_STATUS}" -ne 0 || "${RECEIVE_STATUS}" -ne 0 || "${FRESH_STATUS}" -ne 0 || "${SEND_STATUS}" -ne 0 ]]; then
  exit 1
fi
exit 0
