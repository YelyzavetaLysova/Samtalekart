#!/usr/bin/env bash
set -e

PYTHONPATH=backend .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 &
backend_pid=$!

cleanup() {
  kill "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm --prefix frontend run dev -- --host 0.0.0.0 --port "${PORT:-5173}"

