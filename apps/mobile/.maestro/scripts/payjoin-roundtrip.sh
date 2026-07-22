#!/usr/bin/env bash
# Orchestrate SatSigner Payjoin on two adb targets:
#   Receiver: Clown (funded)
#   Sender:   Sample (segwit)
#
# Leave the receiver on the Receive screen while the sender pays.
#
# Usage:
#   RECEIVER_SERIAL=emulator-5554 \
#   SENDER_SERIAL=emulator-5556 \
#   APP_ID=com.satsigner.satsigner.dev.feat_bitcoin_core_rpc \
#   ./apps/mobile/.maestro/scripts/payjoin-roundtrip.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ID="${APP_ID:-com.satsigner.satsigner.dev.feature_payjoin}"
RECEIVER_SERIAL="${RECEIVER_SERIAL:?set RECEIVER_SERIAL}"
SENDER_SERIAL="${SENDER_SERIAL:?set SENDER_SERIAL}"
CLOWN_ACCOUNT_NAME="${CLOWN_ACCOUNT_NAME:-Clown}"
CLOWN_MNEMONIC="${CLOWN_MNEMONIC:-clown believe select betray misery shine bone coyote benefit evoke auction hybrid famous equip know embark will alter mushroom beauty creek online announce hidden}"
URI_FILE="${URI_FILE:-/tmp/satsigner-payjoin-uri.txt}"

echo "==> Receiver ($RECEIVER_SERIAL): ${CLOWN_ACCOUNT_NAME} (must be funded)"
# Seed on clipboard for first-time import on that device
adb -s "$RECEIVER_SERIAL" shell "cmd clipboard set-text $(printf '%q' "${CLOWN_MNEMONIC}")" >/dev/null 2>&1 || true

maestro --device "$RECEIVER_SERIAL" test \
  -e "APP_ID=$APP_ID" \
  -e "CLOWN_ACCOUNT_NAME=$CLOWN_ACCOUNT_NAME" \
  -e "CLOWN_MNEMONIC=$CLOWN_MNEMONIC" \
  "$ROOT/flows/payjoin-receive-clown-signet.yaml"

URI="$(adb -s "$RECEIVER_SERIAL" shell "cmd clipboard get-clip" 2>/dev/null | tr -d '\r' || true)"
if [[ -z "$URI" || "$URI" != *pj=* ]]; then
  if [[ -f "$URI_FILE" ]]; then
    URI="$(cat "$URI_FILE")"
  fi
fi

if [[ -z "$URI" || "$URI" != *pj=* ]]; then
  echo "Could not read Payjoin URI from Clown clipboard."
  echo "Fund Clown on signet, paste the URI into $URI_FILE, or set PAYJOIN_URI."
  exit 1
fi

echo "$URI" >"$URI_FILE"
echo "==> Payjoin URI saved to $URI_FILE"

echo "==> IMPORTANT: keep Clown on the Receive screen."
echo "==> Sender ($SENDER_SERIAL): Sample (segwit)"
maestro --device "$SENDER_SERIAL" test \
  -e "APP_ID=$APP_ID" \
  -e "PAYJOIN_URI=$URI" \
  "$ROOT/flows/payjoin-send-signet.yaml"

echo "==> Done. Confirm Clown shows Payjoin complete / incoming tx."
