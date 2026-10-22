# MANDATE Testing and Evidence Verification

This document details the test suites, verification commands, and reproducibility checks for MANDATE.

---

## Test Suites

| What | Command | Scope & Expected Output |
|---|---|---|
| **Engine Tests (E4.3.1)** | `docker run --rm --network none -v "$(cygpath -w "$(pwd)/.."):/v:ro" -w /v/prototype mandate-control-e43:1 python -m unittest tests.test_engine_e431 tests.test_e421_rules_on_e431` | 34 + 60 tests passing (`tests/runs/*-regression-E431/`). |
| **Historical Suites** | Same image, `tests.test_engine` … `tests.test_engine_e421` | Regression validation across historical engines (all pass). |
| **Live End-to-End Suite** | `MANDATE_ENGINE=E4.3.1 bash run_prototype.sh e2e` | 17/17 end-to-end integration journeys passing. |
| **Workbench E2E Suite** | `python e2e/workbench_e2e.py <run_dir>` | 25/25 checks passing against tool effect logs. |
| **Workbench Unit Suite** | `python -m unittest console/tests/test_workbench_unit.py` | 12/12 unit tests passing (no Docker required). |
| **Console Integration** | `python console/tests/test_console_integration.py` (with demo running) | 21 integration tests validating API and UI consistency. |
| **Evidence Integrity** | `python ../tools/verify_evidence.py verify` | Manifest verification: 0 files changed / 0 missing. |

---

## Building the Base Image

If the `mandate-spike-py312:wave2` image is missing from your local Docker cache:

```bash
cd ../images/spike-py312
docker build -t mandate-spike-py312:wave2 .
```

*Note: The build fetches pinned Cedar and cvc5 binaries, along with pinned Python packages from PyPI. Complete lock files are located in `images/spike-py312/lock/requirements.lock.txt`.*

---

## Verifying Evidence Packs Offline

Any decision exported from the console (Decisions page → **Export verifiable evidence pack**) can be cryptographically verified offline without running Docker or the control plane:

```bash
python console/verify_evidence_pack.py <decision_id>.evidence.json
```

This verifies that:
1. The decision matches the hash-chained audit record.
2. The hash chain links backwards unbroken to the initial root anchor.
3. The mock tool server logged side-effects only if the verdict was ALLOW.
