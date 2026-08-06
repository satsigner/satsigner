#!/usr/bin/env bash
# Thin payjoin send wrapper — forwards PAYJOIN_URI as Maestro -e (does not special-case the runner).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FLOW="$(cd "${SCRIPT_DIR}/.." && pwd)/flows/payjoin-send-signet.yaml"
EXTRA=()
if [[ -n "${PAYJOIN_URI:-}" ]]; then
  EXTRA+=(-e "PAYJOIN_URI=${PAYJOIN_URI}")
fi
exec bash "${SCRIPT_DIR}/run-with-results.sh" ${EXTRA[@]+"${EXTRA[@]}"} "$@" "${FLOW}"
