"""HTTP helpers from workbench_e2e.py (same behaviour), importable without running that suite."""
import json, os, subprocess, time, urllib.error, urllib.request
from pathlib import Path

C = os.environ.get("MANDATE_CONSOLE_URL", "http://127.0.0.1:8090")
ROOT = Path(__file__).resolve().parent.parent
ENV = {**os.environ, "MSYS_NO_PATHCONV": "1", "SPIKE_IMAGE": "mandate-spike-py312:wave2", "NGINX_IMAGE": "x", "RUN_DIR": "x"}
DC = ["docker", "compose", "-f", str(ROOT / "compose.yaml")]


def call(path, body=None, csrf=True, raw=None):
    data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
    h = {"Content-Type": "application/json"}
    if csrf and data is not None:
        h["X-Console-Action"] = "1"
    req = urllib.request.Request(C + path, data=data, method="GET" if data is None else "POST", headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def effects():
    out = subprocess.run(DC + ["exec", "-T", "backend", "cat", "/log/effects.jsonl"], capture_output=True, text=True, env=ENV).stdout
    return [json.loads(l) for l in out.splitlines() if l.strip()]


def wait(rid, secs=240):
    r = {}
    for _ in range(secs):
        st, r = call(f"/console/workbench/runs/{rid}")
        if r.get("status") in ("done", "failed"):
            return r
        time.sleep(1)
    return r


def run(spec):
    st, r = call("/console/workbench/run", spec)
    if st != 202:
        return st, r
    return st, wait(r["id"])


def tool_events(r):
    return [e for e in r["events"] if e["kind"] == "tool"]
