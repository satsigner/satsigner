#!/usr/bin/env bash
# Write STATUS.json + normalize failure.png for the agent feedback loop.
# Usage: write-run-status.sh <resultsDir> <exitCode> <flow> <appId> <startedAt> <endedAt>
set -euo pipefail

RESULTS_DIR="${1:?results dir}"
EXIT_CODE="${2:?exit code}"
FLOW="${3:?flow}"
APP_ID="${4:?app id}"
STARTED_AT="${5:?started at}"
ENDED_AT="${6:?ended at}"

python3 - "${RESULTS_DIR}" "${EXIT_CODE}" "${FLOW}" "${APP_ID}" "${STARTED_AT}" "${ENDED_AT}" <<'PY'
import glob
import json
import os
import shutil
import sys
import xml.etree.ElementTree as ET

results_dir, exit_code_s, flow, app_id, started_at, ended_at = sys.argv[1:7]
exit_code = int(exit_code_s)
ok = exit_code == 0

screenshots = []
for pattern in ("*.png", os.path.join("**", "*.png")):
    screenshots.extend(glob.glob(os.path.join(results_dir, pattern), recursive=True))
screenshots = sorted(dict.fromkeys(screenshots))

failure_candidates = [
    p
    for p in screenshots
    if "❌" in os.path.basename(p) or "fail" in os.path.basename(p).lower()
]

def junit_message(path):
    if not os.path.isfile(path):
        return None
    root = ET.parse(path).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
    for suite in suites:
        for case in suite.findall("testcase"):
            node = case.find("failure")
            if node is None:
                node = case.find("error")
            if node is None:
                continue
            msg = (node.attrib.get("message") or "").strip()
            text = (node.text or "").strip()
            name = case.attrib.get("name") or case.attrib.get("classname") or "unknown"
            parts = [f"FAIL: {name}"]
            if msg:
                parts.append(msg)
            elif text:
                parts.append(text[:500])
            return " | ".join(parts)
    return None

def commands_message(path):
    if not os.path.isfile(path):
        return None
    try:
        items = json.load(open(path, encoding="utf-8"))
    except Exception:
        return None
    for item in reversed(items):
        meta = item.get("metadata") or {}
        status = (meta.get("status") or "").upper()
        if status not in ("FAILED", "ERROR"):
            continue
        insight = meta.get("insight") or {}
        if isinstance(insight, dict):
            msg = (insight.get("message") or "").strip()
        else:
            msg = str(insight).strip()
        cmd = item.get("command") or {}
        kind = next(iter(cmd.keys()), "command")
        return f"{status}: {kind}" + (f" — {msg}" if msg else "")
    return None

failure_message = None
if not ok:
    failure_message = junit_message(os.path.join(results_dir, "report.xml"))
    if not failure_message:
        cmd_jsons = sorted(glob.glob(os.path.join(results_dir, "commands-*.json")))
        if cmd_jsons:
            failure_message = commands_message(cmd_jsons[0])
    if not failure_message:
        failure_message = f"Maestro exited with code {exit_code}"
    # Keep STATUS.json agent-friendly (no multi-KB stacks)
    if len(failure_message) > 400:
        failure_message = failure_message[:400].rstrip() + "…"

    primary = failure_candidates[0] if failure_candidates else (
        screenshots[0] if screenshots else None
    )
    if primary:
        dest = os.path.join(results_dir, "failure.png")
        if os.path.abspath(primary) != os.path.abspath(dest):
            shutil.copy2(primary, dest)
        if dest not in screenshots:
            screenshots.insert(0, dest)

status = {
    "ok": ok,
    "exitCode": exit_code,
    "flow": flow,
    "appId": app_id,
    "startedAt": started_at,
    "endedAt": ended_at,
    "artifactDir": results_dir,
    "failureMessage": failure_message,
    "screenshots": screenshots
}

out = os.path.join(results_dir, "STATUS.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(status, f, indent=2, ensure_ascii=False)
    f.write("\n")
print(out)
PY
