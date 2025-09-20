#!/usr/bin/env bash
set -euo pipefail

# Start FastAPI worker and Next.js web app together.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

cd "$ROOT_DIR/apps/worker"
python3 -m venv .venv >/dev/null 2>&1 || true
source .venv/bin/activate
pip install -q -r requirements.txt >/dev/null 2>&1 || true
uvicorn main:app --app-dir . --host 127.0.0.1 --port 8000 --reload &
WORKER_PID=$!

cleanup() {
  echo "\nStopping worker ($WORKER_PID)"; kill $WORKER_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$ROOT_DIR/apps/web"
npm run dev

