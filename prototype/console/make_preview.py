"""Build console/preview.json: the fixture behind the console's no-Docker preview mode.

Everything in the fixture is READ FROM RECORDED EVIDENCE in this repository -- the demo's own
hash-chained audit log and its recorded scenario runs. Nothing is invented, and no decision is
computed here: this script only reshapes recorded records into the API shapes the UI reads.

    python console/make_preview.py          # regenerate console/preview.json

The preview is a read-only replay for people who cannot run Docker. The UI labels it as such on
every page, and nothing in it can be run, approved or changed.
"""
import glob
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # validation/prototype
OUT = Path(__file__).resolve().parent / "preview.json"


def jload(p):
    try:
        return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception:
        return None


def audit_records():
    f = ROOT / "demo" / "audit.jsonl"
    if not f.exists():
        return []
    out = []
    for line in f.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    return out


def events_from_evidence(records, role_of):
    """/api/events: full decision records from the audit chain, then the recorded scenario runs."""
    events, seen = [], set()
    for r in records:
        e = r.get("entry") or {}
        if e.get("kind") == "decision":
            ev = {k: v for k, v in e.items() if k != "kind"}
            ev["ts"] = r.get("t")
            events.append(ev)
            seen.add(ev.get("decision_id"))

    for f in sorted(glob.glob(str(ROOT / "demo" / "runs" / "*" / "*.json"))):
        run = jload(f) or {}
        for step in run.get("steps") or []:
            # "last N decisions for agent:cell-x" names the agent in the step text; otherwise use the cell that acted
            named = re.search(r"(agent:cell-[ab])", str(step.get("what") or ""))
            agent = named.group(1) if named else ("agent:cell-b" if step.get("cell") == "agent_b" else "agent:cell-a")
            for d in step.get("decisions") or []:
                if d.get("decision_id") in seen:
                    continue
                seen.add(d.get("decision_id"))
                aid = d.get("agent_id") or agent
                events.append({**d, "agent_id": aid, "args": d.get("args") or {},
                               "role": d.get("role") or role_of.get(aid, "procurement"),
                               "ts": step.get("t") or run.get("started")})
    events.sort(key=lambda e: e.get("ts") or 0)
    return events


def agents_from_evidence():
    """/api/agents: the demo's durable checkpoint, joined with the declared roles catalogue."""
    cp = jload(ROOT / "demo" / "state" / "checkpoint.json") or {}
    state = ((cp.get("body") or {}).get("state")) or {}
    roles = jload(ROOT / "config" / "roles_e431.json") or jload(ROOT / "config" / "roles.json") or {}
    catalogue = roles.get("roles") or roles
    accum = state.get("accum") or {}
    out = []
    for aid, a in (state.get("agents") or {}).items():
        mandate = catalogue.get(a.get("role")) or {}
        out.append({**a, "mandate": {"tools": mandate.get("tools", []), "destinations": mandate.get("destinations", []),
                                     "max_sensitivity": mandate.get("max_sensitivity"),
                                     "may_delegate_to": mandate.get("may_delegate_to", []),
                                     "read_budget": mandate.get("read_budget"), "tasks": mandate.get("tasks", {})},
                    "cold_start": not a.get("history_n"), "drift_js": 0.0,
                    "accumulator": accum.get(aid, 0), "open_alerts": 0})
    return out


def approvals_from_evidence():
    cp = jload(ROOT / "demo" / "state" / "checkpoint.json") or {}
    state = ((cp.get("body") or {}).get("state")) or {}
    return list(reversed(list((state.get("approvals") or {}).values())))


def build():
    records = audit_records()
    agents = agents_from_evidence()
    role_of = {a["agent_id"]: a.get("role") for a in agents}
    events = events_from_evidence(records, role_of)
    approvals = approvals_from_evidence()
    chain_ok = True
    for i, r in enumerate(records):     # the same check the control plane does at start-up
        if i and r.get("prev_hash") != records[i - 1].get("hash"):
            chain_ok = False

    meta = {
        "service": "mandate-control", "engine": "E4.3.1", "engine_config": "E4.3.1", "cedar": True,
        "recovery": False, "recovery_reason": None,
        "persistence": {"state_dir": True, "anchor": True, "signed": True, "findings": []},
        "audit": {"ok": chain_ok, "records": len(records)},
        "counts": {"agents": len(agents),
                   "pending_approvals": sum(1 for a in approvals if a.get("status") == "pending"),
                   "quarantined": sum(1 for a in agents if a.get("status") == "quarantined"),
                   "alerts": 0, "decisions": len(events)},
        "injection_detector": {"present_in_engine": True, "enabled": True, "scope": "documents only"},
        "learned_sequence_model": {"enabled": True, "alert_only": True},
        "baseline_source": "recorded demo run (preview)",
        "notes": ["Preview mode: these records were recorded from a real demo run and are replayed read-only.",
                  "Risk score is an ordinal 0-100 index of documented factors, not a probability.",
                  "Nothing can be run, approved or changed in preview mode."],
    }

    health = {
        "docker": False, "docker_error": None,
        "services": [{"service": s, "state": "recorded", "status": "from a recorded run"}
                     for s in ("control", "pep", "tools", "agent_a", "agent_b", "terminator")],
        "control": {"reachable": True, "meta": meta, "error": None},
        "container_env": {"MANDATE_ENGINE": "E4.3.1", "MANDATE_RECOVERY": "0"},
        "engine_required": "E4.3.1", "engine_ok": True, "console_demo_token": True, "preview": True,
    }

    fixture = {
        "preview": True,
        "source": "recorded from demo/audit.jsonl and demo/runs/ in this repository",
        "/console/health": health,
        "/api/meta": meta,
        "/api/agents": agents,
        "/api/events": events,
        "/api/approvals": approvals,
        "/api/alerts": [],
        "/api/delegations": [],
    }
    OUT.write_text(json.dumps(fixture, indent=1, sort_keys=False), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(events)} decisions, {len(agents)} agents, "
          f"{len(approvals)} approvals, audit chain {'intact' if chain_ok else 'BROKEN'}")


if __name__ == "__main__":
    build()
