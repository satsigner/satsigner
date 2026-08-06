#!/usr/bin/env bash
# Snapshot Android process memory for the payjoin variant.
# Usage:
#   ./apps/mobile/.maestro/scripts/meminfo-payjoin.sh [label]
#   ./apps/mobile/.maestro/scripts/meminfo-payjoin.sh waiting-receiver
set -euo pipefail

PKG="${PAYJOIN_PKG:-com.satsigner.satsigner.dev.feature_payjoin}"
LABEL="${1:-snapshot}"
SERIAL="${ANDROID_SERIAL:-}"
ADB=(adb)
if [[ -n "$SERIAL" ]]; then
  ADB=(adb -s "$SERIAL")
fi

DEVICE="$("${ADB[@]}" devices | awk '/device$/{print $1; exit}')"
if [[ -z "$DEVICE" ]]; then
  echo "No adb device/emulator attached" >&2
  exit 1
fi
ADB=(adb -s "$DEVICE")

PID="$("${ADB[@]}" shell pidof -s "$PKG" 2>/dev/null | tr -d '\r' || true)"
if [[ -z "$PID" ]]; then
  echo "Package not running: $PKG" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${PAYJOIN_MEMINFO_DIR:-/tmp/satsigner-meminfo}"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/${STAMP}-${LABEL}.txt"

"${ADB[@]}" shell dumpsys meminfo "$PKG" >"$OUT"

# Prefer TOTAL PSS / Java heap / Native heap lines when present.
{
  echo "label=$LABEL"
  echo "pkg=$PKG"
  echo "pid=$PID"
  echo "device=$DEVICE"
  echo "file=$OUT"
  rg -n 'TOTAL PSS:|TOTAL RSS:|Java Heap:|Native Heap:|Graphics:|Private Other:|System:' "$OUT" || true
} | tee "$OUT_DIR/${STAMP}-${LABEL}.summary.txt"
