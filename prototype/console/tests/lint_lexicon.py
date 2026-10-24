"""Lint static UI files and judge documentation to enforce single canonical lexicon."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

FORBIDDEN = [
    (re.compile(r"\bPEP\b"), "Use 'Checkpoint' instead of 'PEP'"),
    (re.compile(r"Threat Score", re.IGNORECASE), "Use 'Risk score' instead of 'Threat Score'"),
    (re.compile(r"\bBlack Box\b", re.IGNORECASE), "Use 'Audit log' or 'Decisions' instead of 'Black Box'"),
    (re.compile(r"\bbuzzer\b", re.IGNORECASE), "Use 'Needs approval' instead of 'buzzer'"),
    (re.compile(r"\bCockpit\b", re.IGNORECASE), "Use 'Agents' or 'Manage' instead of 'Cockpit'"),
    (re.compile(r"\bHeld for Approval\b", re.IGNORECASE), "Use 'Needs approval' instead of 'Held for Approval'"),
]

TARGETS = [
    ROOT / "console" / "static" / "app.js",
    ROOT / "console" / "static" / "workbench.js",
    ROOT / "console" / "static" / "lexicon.js",
    ROOT / "console" / "static" / "index.html",
    ROOT / "QUICKSTART.md",
    ROOT.parent / "README.md",
]

def check():
    errors = 0
    for target in TARGETS:
        if not target.exists():
            print(f"[FAIL] Missing target: {target}")
            errors += 1
            continue
        text = target.read_text(encoding="utf-8")
        for line_no, line in enumerate(text.splitlines(), start=1):
            # Skip code comments referencing the legacy rule or glossary keys
            if "//" in line and ("gate" in line or "PEP" in line or "legacy" in line or "Never these" in line):
                continue
            if "term(\"pep\"" in line or "term(\"am11\"" in line or "data-term=\"pep\"" in line or "pep:" in line:
                continue
            if "pep/pep_proto.py" in line or "pep_results" in line:
                continue
            for pattern, msg in FORBIDDEN:
                if pattern.search(line):
                    print(f"[FAIL] {target.name}:{line_no}: {msg} -> Line: {line.strip()[:100]}")
                    errors += 1

    if errors == 0:
        print("[PASS] Lexicon check: zero forbidden terms found in UI and documentation.")
    return errors == 0

if __name__ == "__main__":
    sys.exit(0 if check() else 1)
