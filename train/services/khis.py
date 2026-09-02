"""KHIS (national Kenya HIS) DHIS2 client and Kenya county geometry data."""
from __future__ import annotations

import json
import os

from services.paths import BASE_DIR

KHIS_BASE = os.getenv("KHIS_BASE_URL", "https://hiskenya.dha.go.ke/api")
KHIS_USER = os.getenv("KHIS_USERNAME", "Tom Hastings")
KHIS_PASS = os.getenv("KHIS_PASSWORD", "N3sh!8112")


def _khis_fetch(dx_ids, ou_id, pe="LAST_MONTH", coc_ids=None):
    """Fetch analytics rows from the KHIS DHIS2 server.
    Same interface as _dhis2_fetch but targets https://hiskenya.dha.go.ke/api.
    """
    import requests as _req
    from requests.auth import HTTPBasicAuth

    base = KHIS_BASE
    url_base = base.rstrip("/") + "/analytics.json"
    auth = HTTPBasicAuth(KHIS_USER, KHIS_PASS)

    if isinstance(dx_ids, (list, set, tuple)):
        dx_str = ";".join(dx_ids)
    else:
        dx_str = dx_ids
    if not dx_str or not dx_str.strip():
        return {}

    if isinstance(ou_id, (list, set, tuple)):
        ou_str = ";".join(ou_id)
    else:
        ou_str = ou_id
    dimensions = [f"dx:{dx_str}", f"pe:{pe}", f"ou:{ou_str}"]
    if coc_ids:
        if isinstance(coc_ids, (list, set, tuple)):
            coc_str = ";".join(coc_ids)
        else:
            coc_str = coc_ids
        dimensions.append(f"co:{coc_str}")

    params = {"dimension": dimensions, "displayProperty": "NAME"}
    resp = _req.get(url_base, params=params, auth=auth, timeout=120)
    if not resp.ok:
        return {}
    data = resp.json()
    rows = data.get("rows", [])
    meta = data.get("metaData", {}).get("items", {})
    # Return per-DE data
    return _khis_parse_per_de(rows, meta)


def _khis_parse_per_de(rows, meta):
    """Parse KHIS analytics rows into per-data-element dict.
    Row format: [dx_id, pe_code, ou_code, value]
    Returns: {dx_id: {period_name: value, ...}, ...}
    Only includes DEs that have data.
    """
    result = {}
    for row in rows:
        if len(row) < 4:
            continue
        dx_id = str(row[0])
        pe_code = str(row[1])
        pe_name = meta.get(pe_code, {}).get("name", pe_code)
        val = float(row[-1]) if row[-1] else 0
        if dx_id not in result:
            result[dx_id] = {}
        result[dx_id][pe_name] = result[dx_id].get(pe_name, 0) + val
    return result


def _khis_parse_per_coc(rows, meta, headers):
    """Parse KHIS analytics rows into per-(DE+COC) dict preserving category combos.
    The column order is dynamic (depends on dimension order):
      [dx, co, pe, ou, value]
    Uses header names to find correct column indices.
    Returns: {"DE_ID.CO_ID": {period_name: value, ...}, ...}
    """
    # Build index map: column name -> index
    col_idx = {}
    for i, h in enumerate(headers):
        col_idx[h.get("name", "")] = i
    dx_col = col_idx.get("dx", 0)
    co_col = col_idx.get("co", 1)
    pe_col = col_idx.get("pe", 2)
    val_col = col_idx.get("value", len(headers) - 1)

    result = {}
    for row in rows:
        if len(row) <= max(dx_col, co_col, pe_col, val_col):
            continue
        dx_id = str(row[dx_col])
        co_code = str(row[co_col])
        composite_key = f"{dx_id}.{co_code}"
        pe_code = str(row[pe_col])
        pe_name = meta.get(pe_code, {}).get("name", pe_code)
        val = float(row[val_col]) if row[val_col] else 0
        if composite_key not in result:
            result[composite_key] = {}
        result[composite_key][pe_name] = result[composite_key].get(pe_name, 0) + val
    return result


def _khis_fetch_disaggregated(dx_ids, ou_id, coc_ids, pe="LAST_MONTH"):
    """Fetch analytics rows with CO dimension, returning per-COC data.
    Returns: {"DE_ID.CO_ID": {period_name: value, ...}, ...}
    """
    import requests as _req
    from requests.auth import HTTPBasicAuth

    base = KHIS_BASE
    url_base = base.rstrip("/") + "/analytics.json"
    auth = HTTPBasicAuth(KHIS_USER, KHIS_PASS)

    if isinstance(dx_ids, (list, set, tuple)):
        dx_str = ";".join(dx_ids)
    else:
        dx_str = dx_ids
    if not dx_str or not dx_str.strip():
        return {}

    if isinstance(ou_id, (list, set, tuple)):
        ou_str = ";".join(ou_id)
    else:
        ou_str = ou_id

    if isinstance(coc_ids, (list, set, tuple)):
        coc_str = ";".join(coc_ids)
    else:
        coc_str = coc_ids

    dimensions = [f"dx:{dx_str}", f"co:{coc_str}", f"pe:{pe}", f"ou:{ou_str}"]
    params = {"dimension": dimensions, "displayProperty": "NAME"}
    resp = _req.get(url_base, params=params, auth=auth, timeout=120)
    if not resp.ok:
        return {}
    data = resp.json()
    rows = data.get("rows", [])
    meta = data.get("metaData", {}).get("items", {})
    headers = data.get("headers", [])
    return _khis_parse_per_coc(rows, meta, headers)


# ── Facility → Ward mapping (for HIV ward-level queries) ─────────
_FACILITY_WARD_MAP = None


def _get_facility_ward_map():
    global _FACILITY_WARD_MAP
    if _FACILITY_WARD_MAP is None:
        ward_path = BASE_DIR / "data" / "facility_ward_mapping.json"
        if ward_path.exists():
            with open(ward_path, "r", encoding="utf-8") as f:
                _FACILITY_WARD_MAP = json.load(f)
        else:
            _FACILITY_WARD_MAP = {}
    return _FACILITY_WARD_MAP


# ── Kenya county centroids (static, for project maps) ──────────────
KENYA_COUNTY_CENTERS = {
    "Meru County": {"lat": 0.0500, "lng": 37.6500},
    "Nairobi": {"lat": -1.2921, "lng": 36.8219},
    "Kiambu": {"lat": -1.1667, "lng": 36.8167},
    "Machakos": {"lat": -1.5167, "lng": 37.2667},
    "Kisumu": {"lat": -0.1022, "lng": 34.7617},
    "Homabay": {"lat": -0.5833, "lng": 34.4500},
    "Migori": {"lat": -1.0667, "lng": 34.4667},
    "Siaya": {"lat": 0.0500, "lng": 34.2833},
    "Mombasa": {"lat": -4.0500, "lng": 39.6667},
    "Turkana": {"lat": 3.1500, "lng": 35.6000},
    "West Pokot": {"lat": 1.5000, "lng": 35.2000},
    "Mandera": {"lat": 3.9333, "lng": 41.8667},
    "Garissa": {"lat": -0.4569, "lng": 39.6583},
    "Kajiado": {"lat": -2.0000, "lng": 36.8833},
    "Nakuru": {"lat": -0.3031, "lng": 36.0667},
    "Nandi": {"lat": 0.1167, "lng": 35.1167},
    "Uasin Gishu": {"lat": 0.5167, "lng": 35.2833},
    "Busia": {"lat": 0.4667, "lng": 34.1167},
    "Kakamega": {"lat": 0.2833, "lng": 34.7500},
    "Bungoma": {"lat": 0.5667, "lng": 34.5667},
    "Trans Nzoia": {"lat": 1.0833, "lng": 34.9500},
    "Elgeyo Marakwet": {"lat": 1.0000, "lng": 35.5000},
    "Nyeri": {"lat": -0.4167, "lng": 36.9500},
    "Kirinyaga": {"lat": -0.5000, "lng": 37.2833},
    "Muranga": {"lat": -0.7167, "lng": 37.1500},
    "Laikipia": {"lat": 0.0833, "lng": 36.8833},
    "Tharaka Nithi": {"lat": -0.0833, "lng": 37.8333},
    "Embu": {"lat": -0.5333, "lng": 37.4500},
    "Kitui": {"lat": -1.3667, "lng": 38.0167},
    "Makueni": {"lat": -1.8000, "lng": 37.6333},
    "Taita Taveta": {"lat": -3.0833, "lng": 38.3667},
    "Kwale": {"lat": -4.1667, "lng": 39.4500},
    "Kilifi": {"lat": -3.6333, "lng": 39.8333},
    "Lamu": {"lat": -2.2667, "lng": 40.9000},
    "Tana River": {"lat": -1.5000, "lng": 39.5000},
    "Wajir": {"lat": 1.7500, "lng": 40.0500},
    "Marsabit": {"lat": 2.3333, "lng": 37.9833},
    "Isiolo": {"lat": 0.3500, "lng": 37.5833},
    "Samburu": {"lat": 1.0000, "lng": 36.8000},
    "Baringo": {"lat": 0.4667, "lng": 35.9667},
    "Kericho": {"lat": -0.3667, "lng": 35.2833},
    "Bomet": {"lat": -0.7833, "lng": 35.3500},
    "Nyamira": {"lat": -0.5667, "lng": 34.9333},
    "Kisii": {"lat": -0.6667, "lng": 34.7667},
    "Vihiga": {"lat": 0.0333, "lng": 34.7167},
    "Narok": {"lat": -1.0833, "lng": 35.8667},
    "Nyandarua": {"lat": -0.2000, "lng": 36.4333},
    "Lamu": {"lat": -2.2667, "lng": 40.9000},
}
