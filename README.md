# MANDATE: Runtime Permission Checkpoint for AI Agents

> MANDATE is a permission checkpoint for AI agents. Every tool an agent tries to use is checked against what that agent was authorized to do, before it runs.

```text
[Agent in Sandbox] ---> (Tool Call) ---> [MANDATE Checkpoint] ---> (If Allowed) ---> [Tool Server]
                                                 |
                       +-------------------------+-------------------------+
                       | Routine                 | Unusual / Tainted       | Outside Mandate
                       v                         v                         v
                   [ ALLOW ]              [ NEEDS APPROVAL ]            [ BLOCKED ]
                 Runs instantly          Paused for human sign-off     Action stopped, agent paused
```

## Two ways in

| Goal | How | Prerequisites | Time |
|---|---|---|---|
| **1. Run the real thing** | `cd prototype && bash demo/launch.sh` | Docker Desktop, Git Bash, Python ≥ 3.10 | **~10 minutes** |
| **2. Verify the evidence** | Read [`REVIEWER_GUIDE.md`](REVIEWER_GUIDE.md) | Python only (evidence verification) | **5 minutes** |


---

## Where the documentation lives

The repository contains extensive audit records and research artifacts. Use this map to navigate:

| Area | Primary Files | Description |
|---|---|---|
| **Front Door & Quickstart** | [`README.md`](README.md), [`prototype/QUICKSTART.md`](prototype/QUICKSTART.md) | Project pitch, instant start, and hands-on judge guide |
| **Architecture & Threat Model** | [`prototype/docs/ARCHITECTURE.md`](prototype/docs/ARCHITECTURE.md), [`prototype/docs/WORKBENCH.md`](prototype/docs/WORKBENCH.md) | Component architecture, data flow, and workbench guide |
| **Testing & Evidence** | [`prototype/docs/TESTING.md`](prototype/docs/TESTING.md), [`REVIEWER_GUIDE.md`](REVIEWER_GUIDE.md) | Test suites, reproducibility steps, and manifest verifier |
| **Troubleshooting & Limits** | [`prototype/docs/TROUBLESHOOTING.md`](prototype/docs/TROUBLESHOOTING.md), [`prototype/FINAL_STATUS_REPORT.md`](prototype/FINAL_STATUS_REPORT.md) | Common errors and resolutions, honest known limitations |
| **Spikes & Isolation Logs** | `S0-env` … `S8-e2e` (`VERDICT.md` in each) | Historical progression, AM11 sandbox enforcement, gate ledgers |

For judges evaluating this submission, start with [`prototype/QUICKSTART.md`](prototype/QUICKSTART.md).
