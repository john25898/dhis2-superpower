"""Path constants and environment bootstrap for the CHAK VISTA dashboard.

IMPORTANT: this module MUST be imported before anything that reads DHIS_*
environment variables, because it parses train/.env and pushes the values
into os.environ (the same behaviour app.py had at import time).
"""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # train/
CSV_PATH = BASE_DIR / "golden_executive_record.csv"
GUIDE_XLSX_PATH = BASE_DIR / "Copy of DATIM DATA ENTRY GUIDE FY26 Q2.xlsx"
TABLE_NAME = "clinics"
MAX_RESULT_ROWS = 100

# ── Per-project data paths ─────────────────────────────────────
# jamii_tekelezi_filters.csv lives with the Jamii Tekelezi project
# (frontend + backend + data together), but is also read by MHU,
# OU resolver and portfolio services.
JAMII_TEKELEZI_DIR = BASE_DIR / "projects" / "jamii_tekelezi"
JAMII_TEKELEZI_FILTERS_CSV = JAMII_TEKELEZI_DIR / "jamii_tekelezi_filters.csv"

# ── Superpower module for DHIS2 live queries ──────────────────────
SUPERPOWER_DIR = BASE_DIR.parent  # ai_translator.py is in the repo root
SUPERPOWER_ENV_PATH = BASE_DIR / ".env"
if SUPERPOWER_ENV_PATH.exists():
    _sp_vars = {}
    with open(SUPERPOWER_ENV_PATH) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and "=" in _line and not _line.startswith("#"):
                _k, _v = _line.split("=", 1)
                _sp_vars[_k.strip()] = _v.strip()
    # Override DHIS credentials so superpower uses the CHAK server
    for _k, _v in _sp_vars.items():
        if _k.startswith("DHIS_") or _k.startswith("GEMINI_API_KEY"):
            os.environ[_k] = _v
