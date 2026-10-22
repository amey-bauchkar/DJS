#!/usr/bin/env bash
# MANDATE judge demo: one-command start (Windows 11 + Docker Desktop + Git Bash).
#   bash demo/launch.sh        -> preflight -> deploy with AM11 gates (engine E4.3.1) -> verify engine + detector -> seed -> console
#   MANDATE_ENGINE=E4.3 bash demo/launch.sh     -> an earlier validated engine (also E4.2.1, E4.2, E4.1); never the server default E2
#   bash demo/stop.sh          -> stop the console and remove the demo containers and volumes
# Console: http://127.0.0.1:8090   (control-plane API: http://127.0.0.1:8800)
set -u
cd "$(dirname "$0")/.."                                    # validation/prototype
for d in "/c/Program Files/Docker/Docker/resources/bin" "/c/Users/$USERNAME/AppData/Local/Programs/DockerDesktop/resources/bin"; do
  [ -d "$d" ] && export PATH="$d:$PATH"
done
export MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8 PYTHONDONTWRITEBYTECODE=1
export MANDATE_ENGINE="${MANDATE_ENGINE:-E4.3.1}" MANDATE_RECOVERY=0 MANDATE_CONSOLE_DEMO_TOKEN=1   # submission engine is explicit, never the server default (E2)
case "$MANDATE_ENGINE" in E4.3.1|E4.3|E4.2.1|E4.2|E4.1) ;; *) echo "unsupported MANDATE_ENGINE=$MANDATE_ENGINE (use E4.3.1, E4.3, E4.2.1, E4.2 or E4.1)"; exit 1;; esac
export SPIKE_IMAGE=mandate-spike-py312:wave2
export NGINX_IMAGE=nginx@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de
PY=python; command -v python >/dev/null 2>&1 || PY=python3
export MANDATE_BASH="$(cygpath -m "$(command -v bash)" 2>/dev/null || command -v bash)"   # console reset uses this Git Bash

fail() {
  echo ""
  echo "------------------------------------------------------------------"
  echo "  MANDATE LAUNCH STOPPED"
  echo "------------------------------------------------------------------"
  echo "  What's wrong:   $1"
  [ -n "${2:-}" ] && echo "  What to do:     $2"
  [ -n "${3:-}" ] && echo "  Command to fix: $3"
  echo "  Troubleshooting guide: docs/TROUBLESHOOTING.md"
  echo "------------------------------------------------------------------"
  exit 1
}

echo "== MANDATE demo launcher (engine $MANDATE_ENGINE)"
echo "-- preflight"
command -v docker >/dev/null 2>&1 || fail "docker CLI not found on PATH" "Install or start Docker Desktop and ensure docker is on your PATH." "start Docker Desktop"
docker info >/dev/null 2>&1 || fail "Docker daemon not reachable" "Start Docker Desktop and wait until it is in the running state." "start Docker Desktop"
command -v "$PY" >/dev/null 2>&1 || fail "Python 3 not found on PATH" "Ensure Python >= 3.10 is installed and reachable from Git Bash." "export PATH=\"/path/to/python:\$PATH\""
"$PY" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" || fail "Python >= 3.10 required on the host" "The current Python interpreter is older than 3.10." "py -3.12 or install Python 3.10+"
docker image inspect "$SPIKE_IMAGE" >/dev/null 2>&1 || fail "Docker image $SPIKE_IMAGE is missing" "Build the local base spike image from the repository." "cd ../images/spike-py312 && docker build -t mandate-spike-py312:wave2 ."
docker image inspect "$NGINX_IMAGE" >/dev/null 2>&1 || { echo "   pulling pinned nginx image"; docker pull "$NGINX_IMAGE" >/dev/null || fail "cannot pull $NGINX_IMAGE" "Check network connection to docker hub." "docker pull $NGINX_IMAGE"; }
if [ -f demo/.console.pid ] && kill -0 "$(cat demo/.console.pid)" 2>/dev/null; then kill "$(cat demo/.console.pid)" 2>/dev/null; sleep 1; fi
"$PY" - <<'PYEOF' || fail "port 8090 or 8800 is already in use by another program" "Stop the other process using port 8090 or set MANDATE_CONSOLE_PORT." "netstat -ano | findstr :8090"
import socket
for p in (8090,):
    s = socket.socket(); s.settimeout(0.5)
    if s.connect_ex(("127.0.0.1", p)) == 0: raise SystemExit(1)
PYEOF
echo "   ok: docker, python, images, ports"

echo "-- deploy (AM11 static gate -> up -> AM11 runtime gate; fail closed)"
out=$(bash run_prototype.sh console 2>&1); rc=$?
echo "$out" | grep -E "exit|REFUSED|TORN|RUN=" | sed 's/^/   /'
[ $rc -eq 0 ] || fail "deployment refused (exit $rc); AM11 gates or docker compose failed" "Check deployment logs and ensure Docker has enough memory." "bash demo/stop.sh && bash demo/launch.sh"
echo "$out" | grep -q "runtime_check_exit=0" || fail "AM11 runtime gate did not pass" "Security checks rejected container configuration." "bash demo/stop.sh && bash demo/launch.sh"

echo "-- verify engine and readiness"
for i in $(seq 1 40); do curl -sf http://127.0.0.1:8800/api/meta -o demo/.meta.json 2>/dev/null && break; sleep 1; done
[ -s demo/.meta.json ] || fail "control plane did not become ready" "Check control plane container output for errors." "docker compose -f compose.yaml logs control"
eng=$("$PY" -c "import json; print(json.load(open('demo/.meta.json'))['engine'])")
[ "$eng" = "$MANDATE_ENGINE" ] || fail "control plane reports engine '$eng', expected $MANDATE_ENGINE" "Restart the stack to ensure clean engine configuration." "bash demo/stop.sh && bash demo/launch.sh"
if [ "$MANDATE_ENGINE" = "E4.3" ] || [ "$MANDATE_ENGINE" = "E4.3.1" ]; then
  det=$("$PY" -c "import json; print(json.load(open('demo/.meta.json')).get('injection_detector',{}).get('enabled'))")
  [ "$det" = "True" ] || fail "$MANDATE_ENGINE is running without its injection detector" "Restore model.onnx before starting." "python ../tools/restore_injection_model.py MANDATE_E4.3_injection_model.zip"
  echo "   injection detector loaded (documents only; structured records are not scanned)"
fi
echo "   control plane ready, engine $eng"
"$PY" console/console.py --seed | sed 's/^/   /' || fail "seeding the demo baseline failed" "Ensure control plane is reachable at 127.0.0.1:8800." "curl -v http://127.0.0.1:8800/api/meta"

if [ -n "${GROQ_API_KEY:-}" ] && [ "${MANDATE_LLM_CONSENT:-}" = "1" ]; then echo "   optional live LLM agent: ENABLED (key from your environment)"; else echo "   optional live LLM agent: disabled (see QUICKSTART.md)"; fi
echo "-- console"
nohup "$PY" console/console.py > demo/console.log 2>&1 &
echo $! > demo/.console.pid
for i in $(seq 1 20); do curl -sf http://127.0.0.1:8090/console/health >/dev/null 2>&1 && break; sleep 1; done
curl -sf http://127.0.0.1:8090/console/health >/dev/null 2>&1 || fail "console did not start (see demo/console.log)" "Check console.log for Python exceptions." "cat demo/console.log"

echo ""
echo "+-------------------------------------------------------------+"
echo "| MANDATE is running.                                         |"
echo "|                                                             |"
echo "| Open http://127.0.0.1:8090                                  |"
echo "| Start with \"Try it\" on the home page.                       |"
echo "|                                                             |"
echo "| Stop with: bash demo/stop.sh                                |"
echo "+-------------------------------------------------------------+"
echo ""
