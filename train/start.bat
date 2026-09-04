@echo off
REM ============================================================
REM  CHAK VISTA - Local launcher
REM  Double-click this file to install deps & start the server
REM  Then open http://localhost:5100 in your browser
REM ============================================================
cd /d "%~dp0"
echo.
echo [1/3] Checking Python...
python --version
if errorlevel 1 (
    echo.
    echo ERROR: Python is not installed or not in PATH.
    echo Install Python 3.10+ from https://www.python.org/downloads/
    echo Make sure to tick "Add Python to PATH" during install.
    pause
    exit /b 1
)

echo.
echo [2/3] Installing dependencies (first run only, may take a few minutes)...
pip install -r requirements.txt

echo.
echo [3/3] Starting server on port 5100...
echo Keep this window open. Then open http://localhost:5100 in your browser.
echo.
python run_flask.py 5100
pause
