#!/usr/bin/env bash
# Copy the newest Studio/CLI run from ~/.maestro/tests into the repo so Cursor can read it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAESTRO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEST="${MAESTRO_DIR}/results/latest"

NEWEST="$(ls -1dt "${HOME}/.maestro/tests"/*/ 2>/dev/null | head -1 || true)"
if [[ -z "${NEWEST}" ]]; then
  echo "No runs under ~/.maestro/tests" >&2
  exit 1
fi

rm -rf "${DEST}"
mkdir -p "${DEST}"
cp -R "${NEWEST%/}/." "${DEST}/"
echo "Synced ${NEWEST%/} → ${DEST}"

# Best-effort STATUS.json for Studio-synced runs (exit unknown → treat as fail if JUnit has failures)
python3 - "${DEST}" <<'PY' 2>/dev/null || true
import glob, json, os, sys, xml.etree.ElementTree as ET
from datetime import datetime, timezone

dest = sys.argv[1]
ok = True
failure_message = None
report = os.path.join(dest, "report.xml")
if os.path.isfile(report):
    root = ET.parse(report).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
    for suite in suites:
        if int(suite.attrib.get("failures", 0) or 0) or int(suite.attrib.get("errors", 0) or 0):
            ok = False
        for case in suite.findall("testcase"):
            node = case.find("failure") or case.find("error")
            if node is not None and failure_message is None:
                msg = (node.attrib.get("message") or "").strip()
                name = case.attrib.get("name") or "unknown"
                failure_message = f"FAIL: {name}" + (f" | {msg}" if msg else "")
shots = sorted(glob.glob(os.path.join(dest, "*.png")))
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
status = {
    "ok": ok,
    "exitCode": 0 if ok else 1,
    "flow": "studio-sync",
    "appId": os.environ.get("APP_ID", ""),
    "startedAt": now,
    "endedAt": now,
    "artifactDir": dest,
    "failureMessage": failure_message,
    "screenshots": shots,
}
with open(os.path.join(dest, "STATUS.json"), "w", encoding="utf-8") as f:
    json.dump(status, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY

bash "${SCRIPT_DIR}/last-failure.sh"
