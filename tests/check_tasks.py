"""Checks the Python course with CPython: every solution passes its tests, every starter fails, every example runs.
tasks.json is an export of PY_UNITS from src/page.html."""
import json, subprocess, sys
from pathlib import Path

def run(code, stdin=()):
    p = subprocess.run([sys.executable, "-I", "-c", code], input="\n".join(stdin) + "\n", capture_output=True, text=True, timeout=10)
    return p.stdout, p.returncode

def passes(t, code):
    if t["kind"] == "out":
        for c in t["tests"]:
            out, rc = run(code, c["stdin"])
            if rc or "\n".join(l.rstrip() for l in out.split("\n")).strip() != c["out"]:
                return False
        return True
    harness = code + "\n\n" + "\n".join(f'try:\n    print("@@" + repr({c["call"]}))\nexcept Exception as e:\n    print("@@!" + type(e).__name__)' for c in t["tests"])
    out, _ = run(harness)
    got = [l[2:] for l in out.split("\n") if l.startswith("@@")]
    return got == [c["exp"] for c in t["tests"]]

bad = []
for t in json.loads((Path(__file__).parent / "tasks.json").read_text(encoding="utf-8")):
    if t["kind"] == "ex":
        if run(t["code"], ["5", "3", "7", "2"])[1]: bad.append(("example fails", t["id"]))
        continue
    if not passes(t, t["solution"]): bad.append(("solution fails", t["id"]))
    if passes(t, t["starter"]): bad.append(("starter passes", t["id"]))
print("problems:", bad or "none")
sys.exit(1 if bad else 0)
