#!/usr/bin/env bash
# Summarize latest Maestro run for humans / agents.
# Usage:
#   last-failure.sh              # auto-detect dir; quiet PASS if STATUS.ok
#   last-failure.sh <exitCode>   # when called from run-with-results
#   last-failure.sh --force      # always print failure sections
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAESTRO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE_LATEST="${MAESTRO_DIR}/results/latest"

FORCE=0
EXIT_HINT=""
for arg in "$@"; do
  case "${arg}" in
    --force) FORCE=1 ;;
    ''|*[!0-9]*) ;;
    *) EXIT_HINT="${arg}" ;;
  esac
done

function pick_dir() {
  if [[ -d "${WORKSPACE_LATEST}" ]] && [[ -n "$(ls -A "${WORKSPACE_LATEST}" 2>/dev/null || true)" ]]; then
    echo "${WORKSPACE_LATEST}"
    return
  fi
  local newest
  newest="$(ls -1dt "${HOME}/.maestro/tests"/*/ 2>/dev/null | head -1 || true)"
  if [[ -n "${newest}" ]]; then
    echo "${newest%/}"
    return
  fi
  echo ""
}

DIR="$(pick_dir)"
if [[ -z "${DIR}" ]]; then
  echo "No Maestro results found."
  echo "Run: pnpm maestro:smoke  (writes .maestro/results/latest)"
  exit 1
fi

OK=""
if [[ -f "${DIR}/STATUS.json" ]]; then
  OK="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("ok",""))' "${DIR}/STATUS.json" 2>/dev/null || true)"
fi
if [[ -z "${OK}" && -n "${EXIT_HINT}" ]]; then
  if [[ "${EXIT_HINT}" == "0" ]]; then OK="True"; else OK="False"; fi
fi

if [[ "${FORCE}" != "1" && ( "${OK}" == "True" || "${OK}" == "true" || "${EXIT_HINT}" == "0" ) ]]; then
  echo "PASS"
  echo "Maestro results: ${DIR}"
  if [[ -f "${DIR}/STATUS.json" ]]; then
    python3 - <<'PY' "${DIR}/STATUS.json" 2>/dev/null || true
import json, sys
s = json.load(open(sys.argv[1]))
print(f"flow: {s.get('flow')}")
print(f"exitCode: {s.get('exitCode')}")
print(f"artifactDir: {s.get('artifactDir')}")
PY
  fi
  exit 0
fi

echo "Maestro results: ${DIR}"
echo ""

if [[ -f "${DIR}/STATUS.json" ]]; then
  echo "== STATUS =="
  python3 - <<'PY' "${DIR}/STATUS.json" 2>/dev/null || true
import json, sys
s = json.load(open(sys.argv[1]))
print(f"ok: {s.get('ok')}")
print(f"exitCode: {s.get('exitCode')}")
print(f"flow: {s.get('flow')}")
msg = s.get("failureMessage")
if msg:
    print(f"failureMessage: {msg}")
shots = s.get("screenshots") or []
if shots:
    print("screenshots:")
    for p in shots[:8]:
        print(f"  {p}")
PY
  echo ""
fi

if [[ -f "${DIR}/report.xml" ]]; then
  echo "== JUnit failures =="
  python3 - <<'PY' "${DIR}/report.xml" 2>/dev/null || true
import sys
import xml.etree.ElementTree as ET
path = sys.argv[1]
root = ET.parse(path).getroot()
suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
found = False
for suite in suites:
    for case in suite.findall("testcase"):
        fail = case.find("failure")
        err = case.find("error")
        node = fail if fail is not None else err
        if node is None:
            continue
        found = True
        name = case.attrib.get("name") or case.attrib.get("classname") or "unknown"
        msg = (node.attrib.get("message") or "").strip()
        text = (node.text or "").strip()
        print(f"FAIL: {name}")
        if msg:
            print(msg[:800] + ("…" if len(msg) > 800 else ""))
        if text and text != msg:
            print(text[:800] + ("…" if len(text) > 800 else ""))
        print("")
if not found:
    print("(no failures in report.xml)")
PY
  echo ""
fi

COMMAND_JSON="$(find "${DIR}" -maxdepth 1 -name 'commands-*.json' | head -1 || true)"
if [[ -n "${COMMAND_JSON}" ]]; then
  echo "== Failed / warned commands =="
  python3 - <<'PY' "${COMMAND_JSON}" 2>/dev/null || true
import json, sys
path = sys.argv[1]
items = json.load(open(path))
interesting = []
for item in items:
    meta = item.get("metadata") or {}
    status = (meta.get("status") or "").upper()
    if status not in ("FAILED", "ERROR", "WARNED"):
        continue
    insight = meta.get("insight") or {}
    if isinstance(insight, dict):
        msg = (insight.get("message") or "").strip()
    else:
        msg = str(insight)
    cmd = item.get("command") or {}
    kind = next(iter(cmd.keys()), "command")
    evaluated = meta.get("evaluatedCommand") or {}
    interesting.append((status, kind, msg, evaluated))
if not interesting:
    print("(none)")
else:
    for status, kind, msg, evaluated in interesting[-15:]:
        print(f"{status}: {kind}")
        if msg:
            print(f"  {msg}")
        if evaluated:
            s = json.dumps(evaluated, ensure_ascii=False)
            print(f"  {s[:500]}")
        print("")
PY
  echo ""
fi

if [[ -f "${DIR}/maestro.log" ]]; then
  echo "== Assertion / failure lines (maestro.log) =="
  if grep -n -i -E 'Assertion failed|CommandFailed|Command execution\] CommandFailed|❌|FAILED' "${DIR}/maestro.log" \
    | tail -40; then
    :
  else
    echo "(no assertion lines — last 20 log lines)"
    tail -20 "${DIR}/maestro.log"
  fi
  echo ""
fi

if [[ -f "${DIR}/failure.png" ]]; then
  echo "== Primary failure screenshot =="
  echo "${DIR}/failure.png"
elif SHOTS="$(find "${DIR}" -maxdepth 2 -type f \( -name '*.png' -o -name '*.jpg' \) 2>/dev/null | head -10)"; [[ -n "${SHOTS}" ]]; then
  echo "== Screenshots =="
  echo "${SHOTS}"
fi
