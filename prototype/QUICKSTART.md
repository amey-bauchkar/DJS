# MANDATE Quickstart Guide

This guide gets you into the MANDATE prototype in minutes.

---

## 1. Quick Requirements

- **Operating System:** Windows 11 with Docker Desktop and Git Bash.
- **Python:** Python ≥ 3.10 on the host.
- **Docker Image:** `mandate-spike-py312:wave2` (see [Building the Image](docs/TESTING.md#building-the-image) if missing).
- **Injection Model:** `config/injection_model/model.onnx` (restore via `python tools/restore_injection_model.py MANDATE_E4.3_injection_model.zip`).
- **External Accounts:** None required. No cloud account or external LLM key is required for default evaluation.


---

## 2. Launch (One Command)

From `prototype/` in Git Bash:

```bash
bash demo/launch.sh
```

The launcher executes preflight checks, validates AM11 cell-isolation gates, starts containers, seeds the demo baseline, and launches the console.

Open your browser to:
👉 **[http://127.0.0.1:8090](http://127.0.0.1:8090)**

When done, stop everything cleanly:
```bash
bash demo/stop.sh
```

*Note: The console holds the demo owner token for you automatically (`MANDATE_CONSOLE_DEMO_TOKEN=1`).*

---

## 3. What to Look at (~10 Minutes)

The console is organized into four clean areas:

1. **Home:** High-level summary of the permission checkpoint, the latest live decision, and current agent roster. Click **"See an attack get blocked →"** to jump straight into action.
2. **Try it:**
   - **Run your own task (`#/task`):** Interactive workbench where you can instruct an agent, inspect planned tool steps, and dry-run or execute against real permissions.
   - **Example attacks (`#/demo`):** 12 guided scenarios (ordinary work, injection attacks, human approvals, crash recovery). **Start with Example 2** (the poisoned invoice).
   - **Quick what-if (`#/simulate`):** Test hypothetical single-action security queries without executing anything.
   - **Live AI model (`#/llm`):** Optional evaluation with a real LLM planner.
3. **Manage:**
   - **Agents (`#/agents`):** Agent permissions, active roles, and controls to pause (quarantine), restrict, or resume agents.
   - **Approvals (`#/approvals`):** Action inbox for requests held for human review. Approvals run exactly once.
   - **Decisions (`#/investigate`):** Complete decision ledger with cryptographic evidence-pack export.
   - **Traffic map (`#/graph`):** Visual map of agent calls to destinations with distinct shapes for allowed, held, and blocked paths.
4. **Evidence:**
   - **Test results (`#/results`):** Empirical measurements across 2,100+ generated scenarios.
   - **Audit log (`#/audit`):** Cryptographically hash-chained, tamper-evident log of every decision.
   - **Known limits (`#/limits`):** Honest register of limitations.
   - **System health (`#/diagnostics`):** Real-time service status, container health, and offline verification checks.

*Tip: Click any dotted-underlined term (like Checkpoint, Risk score, Sandbox) for a plain-language definition.*

---

## 4. Optional: Live LLM Agent

The base demo runs entirely offline with deterministic mock agents. To connect a live Groq model (`openai/gpt-oss-120b`):

```bash
export GROQ_API_KEY=your-api-key
export MANDATE_LLM_CONSENT=1
bash demo/launch.sh
```

Then navigate to **Try it → Live AI model** in the console.

---

## Need Help?
- Architecture details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Test suites & verification: [`docs/TESTING.md`](docs/TESTING.md)
- Symptom-to-fix lookup: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)
