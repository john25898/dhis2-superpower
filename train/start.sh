#!/usr/bin/env bash
# ============================================================
#  CHAK VISTA - Local launcher (Linux / Ubuntu / macOS)
#  Run:  bash start.sh
#  Then open http://localhost:5100 in your browser
# ============================================================
set -e
cd "$(dirname "$0")"

echo "[1/4] Checking Python..."
if command -v python3 >/dev/null 2>&1; then
    PY=python3
elif command -v python >/dev/null 2>&1; then
    PY=python
else
    echo "ERROR: Python not found. Install it:"
    echo "  sudo apt update && sudo apt install -y python3 python3-pip python3-venv"
    exit 1
fi
$PY --version

echo "[2/4] Installing dependencies (first run only, may take a few minutes)..."
if ! command -v pip3 >/dev/null 2>&1 && ! $PY -m pip --version >/dev/null 2>&1; then
    echo "Installing pip..."
    sudo apt update && sudo apt install -y python3-pip
fi
$PY -m pip install -r requirements.txt

echo "[3/4] Starting server on port 5100..."
echo "Keep this terminal open. Then open http://localhost:5100 in your browser."
echo
$PY run_flask.py 5100
