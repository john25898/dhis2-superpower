"""Superpower (ai_translator) integration for DHIS2 live queries.

The ai_translator module lives in the repo root (SUPERPOWER_DIR) and is
imported lazily so the app can still start if it is missing.
"""
from __future__ import annotations

import sys

from services.paths import SUPERPOWER_DIR

sys.path.insert(0, str(SUPERPOWER_DIR))
try:
    from ai_translator import generate_dhis2_url as _superpower_generate_url
    from ai_translator import fetch_query_result as _superpower_fetch_result
    from ai_translator import load_dictionaries as _superpower_load_dict
    HAS_SUPERPOWER = True
except Exception:
    HAS_SUPERPOWER = False
    _superpower_generate_url = None
    _superpower_fetch_result = None
    _superpower_load_dict = None
