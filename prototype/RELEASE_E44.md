# Release E4.4 (candidate, not yet frozen)

E4.3.1 is untouched (`mandate/engine_e431.py`, `FROZEN_*.sha256` still valid). E4.4 is a new file, `mandate/engine_e44.py`, with `config/engine_config_e44.json`. Select it with `MANDATE_ENGINE=E4.4`.

| Review gap | Change |
|---|---|
| Learned model alert-only | Wired as learned deviation but ships at **0 points**: at 6 points h5eval regressed (see below). Set `points.learned_sequence_anomaly` to enable. |
| Rate evasion | `tool_rate_spike`: per-tool count in the rate window vs expected (learned tool share x learned total rate), Poisson z > 3 and count >= 4. |
| Static baseline | `ref_tool` is re-snapshotted from the anti-poisoned baseline every 50 clean events (active agent, quiet accumulator). Audit record `reference_refreshed`. |
| No explain view | `GET /api/agents/{aid}/drift/explain` (owner token) returns verdict, JS divergence, accumulator, points by factor, largest tool shifts, recent decisions. |

Tests: `tests/test_engine_e44.py` (new), plus the E4.2.1 rule suite and E4.3.1 suite re-run on E4.4 (`*_on_e44.py`).

Known limit, unchanged: a mimic that stays inside its learned tool mix and pace is not statistically detectable. Deterministic rules and the injection scanner still cover it.

## h5eval, seeds 971-975 (effect-classified, engine-level, AI-generated scenarios)
| | E4.3.1 | E4.4 with sequence = 6 | E4.4 shipped (sequence = 0) |
|---|---|---|---|
| Attacks SUCCEEDED | 30 (C4, known) | 60 (+C10 30/30) | 30 (C4, known) |
| Attacks APPROVAL_PENDING | 540 | 510 | 540 |
| Benign CLEAN / FRICTION | 716 / 124 | 696 / 144 (B2 0 -> 18 friction) | 716 / 124 |
| Benign action denies | 2005 | 2393 | 2005 |
The shipped E4.4 reproduces E4.3.1 on this suite. The per-tool rate and reference refresh are neutral here, because the suite does not exercise them; they are covered by unit tests only.
