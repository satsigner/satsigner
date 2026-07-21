#!/usr/bin/env bash
# Orchestrate SatSigner Payjoin receive + send on two adb targets.
#
# Usage:
#   RECEIVER_SERIAL=emulator-5554 \
#   SENDER_SERIAL=emulator-5556 \
#   RECEIVER_NAME='pj-recv' \
#   SENDER_NAME='pj-send' \
#   APP_ID=com.satsigner.satsigner.dev \
#   ./apps/mobile/.maestro/scripts/payjoin-roundtrip.sh
#
# Both devices must already have funded signet singlesig accounts.
# Leave the receiver flow running (Receive screen open) while the sender pays.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ID="${APP_ID:-com.satsigner.satsigner.dev}"
RECEIVER_SERIAL="${RECEIVER_SERIAL:?set RECEIVER_SERIAL}"
SENDER_SERIAL="${SENDER_SERIAL:?set SENDER_SERIAL}"
RECEIVER_NAME="${RECEIVER_NAME:?set RECEIVER_NAME}"
SENDER_NAME="${SENDER_NAME:?set SENDER_NAME}"
URI_FILE="${URI_FILE:-/tmp/satsigner-payjoin-uri.txt}"

echo "==> Receiver ($RECEIVER_SERIAL): $RECEIVER_NAME"
maestro --device "$RECEIVER_SERIAL" test \
  -e "APP_ID=$APP_ID" \
  -e "ACCOUNT_NAME=$RECEIVER_NAME" \
  "$ROOT/flows/payjoin-receive-signet.yaml"

# Prefer clipboard from the receiver device after the flow copied the URI.
URI="$(adb -s "$RECEIVER_SERIAL" shell "cmd clipboard get-clip" 2>/dev/null | tr -d '\r' || true)"
if [[ -z "$URI" || "$URI" != *pj=* ]]; then
  if [[ -f "$URI_FILE" ]]; then
    URI="$(cat "$URI_FILE")"
  fi
fi

if [[ -z "$URI" || "$URI" != *pj=* ]]; then
  echo "Could not read Payjoin URI from receiver clipboard."
  echo "Paste the URI into $URI_FILE and re-run the sender step, or set PAYJOIN_URI."
  exit 1
fi

echo "$URI" >"$URI_FILE"
echo "==> Payjoin URI saved to $URI_FILE"

echo "==> IMPORTANT: keep the receiver on the Receive screen (re-run receive flow if needed)."
echo "==> Sender ($SENDER_SERIAL): $SENDER_NAME"
maestro --device "$SENDER_SERIAL" test \
  -e "APP_ID=$APP_ID" \
  -e "ACCOUNT_NAME=$SENDER_NAME" \
  -e "PAYJOIN_URI=$URI" \
  "$ROOT/flows/payjoin-send-signet.yaml"

echo "==> Done. Confirm receiver shows Payjoin completed / incoming tx."
