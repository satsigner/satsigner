#!/usr/bin/env bash
# Prep emulator/device for Expo Dev Client + Maestro.
set -euo pipefail

export PATH="${HOME}/.maestro/bin:${PATH}"
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-120000}"

# Drop stale session locks (Studio/CLI fight over the Android driver)
: > "${HOME}/.maestro/sessions" 2>/dev/null || true

# Device localhost:8081 → host Metro
if command -v adb >/dev/null 2>&1; then
  ADB=(adb)
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    ADB=(adb -s "${ANDROID_SERIAL}")
  fi
  "${ADB[@]}" reverse tcp:8081 tcp:8081 >/dev/null
  echo "adb reverse tcp:8081 tcp:8081 OK"
  # Stylus / handwriting drawer steals Maestro inputText on some AVDs
  "${ADB[@]}" shell settings put secure stylus_handwriting_enabled 0 >/dev/null 2>&1 || true
  "${ADB[@]}" shell settings put system stylus_handwriting_enabled 0 >/dev/null 2>&1 || true
else
  echo "adb not found — skip reverse" >&2
fi

if ! curl -sf http://127.0.0.1:8081/status >/dev/null; then
  echo "WARN: Metro not reachable on :8081 — start with: APP_VARIANT=development npx expo start" >&2
else
  echo "Metro OK on :8081"
fi
