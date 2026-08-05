#!/usr/bin/env bash
# Studio should open the YAML source of truth directly (no duplicate tree, no symlink).
# Symlinking under apps/mobile/ crashed Metro (TreeFS: dir → symlink).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAESTRO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LINK_PATH="$(cd "${MAESTRO_DIR}/.." && pwd)/maestro/satsigner-workspace"

if [[ -L "${LINK_PATH}" ]]; then
  rm -f "${LINK_PATH}"
  echo "Removed symlink ${LINK_PATH} (unsafe under Metro watch)."
elif [[ -d "${LINK_PATH}" ]]; then
  echo "WARNING: ${LINK_PATH} is a real directory — delete it and use .maestro/ only." >&2
  exit 1
fi

echo "Open this folder in Maestro Studio:"
echo "  ${MAESTRO_DIR}"
echo "Edit flows only under .maestro/flows/ (single source of truth)."
