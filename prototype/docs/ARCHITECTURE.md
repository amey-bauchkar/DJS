# MANDATE System Architecture

MANDATE provides runtime governance and enforcement for AI agents through isolated sandboxes, policy checkpoints, and a cryptographically audited control plane.

---

## Architecture Diagram

![MANDATE Architecture](architecture.svg)

---

## Core Components

| Component | Repository Location | Role & Implementation |
|---|---|---|
| **Agent Cells (A & B)** | `compose.yaml` (`agent_a`, `agent_b`), `pep/agent_proto.py` | Isolated Linux network namespaces running under AM11 cell constraints. Agents run scripted workflows or receive instructions from the live LLM host adapter (`console/llm_agent.py`). No direct network egress. |
| **Sidecar & mTLS Terminator** | `../S7-binding` configuration | Binds every egress HTTP call to the cell identity via mutual TLS and cell-scoped tokens. Prevents spoofing or cross-cell impersonation. |
| **Policy Enforcement Point (PEP)** | `pep/pep_proto.py` | Sits inline on the agent's outbound path. Queries the control plane for every tool call before execution (fails closed). For allowed reads, pipes untrusted payloads to `/api/observe` for prompt injection scanning prior to delivering content to the agent. |
| **MANDATE Control Plane** | `control/server.py`, `mandate/engine_e431.py`, `mandate/content_scanner.py`, `mandate/state_e42.py` | Evaluates requests against Cedar policies and engine rules; executes document scanning, manages approvals and agent pause states, and appends to the hash-chained audit log. |
| **Mock Tool Server** | `pep/backend_proto.py` | Executes actions **only on ALLOW**. Records all actual side effects in an independent, observable log (`/log/effects.jsonl`). |
| **Console & Web UI** | `console/console.py`, `console/static/` | Operator and evaluator interface. Proxies owner-authenticated control APIs, runs scenario tests, offers interactive task simulation, and verifies cryptographic evidence offline. |

---

## Key Security Invariants

1. **Fail Closed:** If the control plane or checkpoint is unreachable, down, or returning an error, all tool calls are blocked.
2. **Dual-Observer Proof:** Decisions are verified by comparing the checkpoint's audit chain against the mock tool server's independent effect log.
3. **One-Time Approval Tokens:** Approvals granted by a human operator authorize exactly one invocation of a specific tool call with matched parameters.
4. **Content-Before-Delivery Scanning:** Untrusted external content (wiki pages, supplier quotes) is scanned for injection vectors *before* the agent receives the text.
