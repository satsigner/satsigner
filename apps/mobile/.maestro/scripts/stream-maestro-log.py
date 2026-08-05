#!/usr/bin/env python3
# Poll maestro.log for step lines; exit when stop-sentinel appears.
# Avoids holding the log open (tail -F can block Maestro shutdown).
import os
import re
import sys
import time

status_re = re.compile(
    r"^(?P<ts>\S+)\s+\[\s*(?P<level>\w+)\s*\]\s+"
    r"(?P<logger>[^:]+):\s+(?P<body>.*)\s+"
    r"(?P<status>RUNNING|COMPLETED|FAILED|SKIPPED|WARNED)\s*$"
)
error_re = re.compile(
    r"^(?P<ts>\S+)\s+\[\s*(?P<level>ERROR|WARN)\s*\]\s+"
    r"(?P<logger>[^:]+):\s+(?P<body>.*)$"
)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: stream-maestro-log.py <maestro.log> <stop-sentinel>", file=sys.stderr)
        return 2
    log_path, stop_path = sys.argv[1], sys.argv[2]
    pos = 0
    seen_wait = False
    while not os.path.exists(stop_path):
        try:
            if os.path.isfile(log_path):
                size = os.path.getsize(log_path)
                if size < pos:
                    pos = 0  # truncated / replaced
                if size > pos:
                    with open(log_path, encoding="utf-8", errors="replace") as f:
                        f.seek(pos)
                        chunk = f.read()
                        pos = f.tell()
                    for line in chunk.splitlines():
                        m = status_re.match(line)
                        if m:
                            print(
                                "  [%s] %s" % (m.group("status"), m.group("body").strip()),
                                flush=True
                            )
                            continue
                        m = error_re.match(line)
                        if m:
                            body = m.group("body").strip()
                            if len(body) > 240:
                                body = body[:240] + "…"
                            print("  [%s] %s" % (m.group("level"), body), flush=True)
                            continue
                        if "Waiting for flows to complete" in line and not seen_wait:
                            seen_wait = True
                            print("  (suite waiting — steps below)", flush=True)
        except OSError:
            pass
        time.sleep(0.2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
