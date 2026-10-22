# MANDATE Troubleshooting Guide

Common symptoms, root causes, and verified fixes when running the MANDATE demo or tests.

---

| Symptom | Fix |
|---|---|
| `PREFLIGHT FAILED: Docker daemon not reachable` | Start Docker Desktop and wait until the status indicator turns green (*running*). |
| `image mandate-spike-py312:wave2 missing` | Build the image: `cd images/spike-py312 && docker build -t mandate-spike-py312:wave2 .` (see [TESTING.md](TESTING.md)). |
| `deployment refused` / `AM11 runtime gate did not pass` | Inspect `e2e/runs/<latest>-console/deploy.log` and `cell_policy_runtime.json`. Run `bash demo/stop.sh`, then launch again. |
| `control plane reports engine 'E2'` | Another container or stack is running without the launcher. Run `bash demo/stop.sh`, then launch with `bash demo/launch.sh`. |
| `REFUSED: E4.3 needs config/injection_model/model.onnx …` | Restore the model: `python ../tools/restore_injection_model.py MANDATE_E4.3_injection_model.zip` (see `MODEL_RESTORE.md`), or launch an earlier engine with `MANDATE_ENGINE=E4.2.1`. |
| `TORN DOWN: E4.3 control plane did not load the injection detector` | The control image lacks onnxruntime, or the model files are incomplete. Delete the image with `docker image rm mandate-control-e43:1` so it rebuilds, and check the model with `python ../tools/restore_injection_model.py - --check`. |
| Red banner *The checkpoint is not answering* / *Control plane unreachable* | Expected right after Example 11 or 12 (simulated crash / tamper). For 11, open **Evidence → System health** or click **Reset to a clean start** in Example attacks. Otherwise inspect logs: `docker compose -f compose.yaml logs control`. |
| Port 8090 in use | Stop the other program using the port, or run `MANDATE_CONSOLE_PORT=8095 python console/console.py`. |
| Scenario shows FAIL with a precondition note | An earlier destructive test changed the state (for example, audit loss recovery). Click **Reset to a clean start** in Example attacks to reload clean state. |
| Browser shows "Preview. You are reading decisions recorded from a real run" | The console was started in read-only preview mode (`--preview`). To run live actions, stop the console and launch via `bash demo/launch.sh`. |
