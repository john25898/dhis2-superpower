"""
PBIX Dashboard Pages — replicates all 16 CHAK Visuals (1).pbix pages
as live DHIS2-powered Flask route groups.

Each page registers a JSON endpoint and renders an HTML template.
Uses the same _dhis2_fetch, _resolve_ou_ids helpers from app.py.
"""

import json
import os
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

import pandas as pd
from flask import (
    Blueprint, Flask, jsonify, render_template, request, current_app,
)

# ── Known DHIS2 Data Element UIDs (all discovered from master_data_elements.csv) ──

# ART Treatment
TX_CURR = "kgzd9LfXZXq"           # C&T (facility) - TX_CURR
TX_NEW = "vTTEybkXZ53"            # TX_NEW: Starting ART
TX_NEW_STA = "zhJLRZbZOh6"        # Tx_New STA
TX_ML = "bv9nAL9x5Q5"             # C&T (facility) - Tx_ML, Outcomes
TX_RTT = "tCFth5mfGz5"            # Tx_RTT

# Viral Load
PVLS_ELIGIBLE = "JGd3MwmKBuM"     # VL Monitoring (All): TX_PVLS (D) Routine
PVLS_DONE = "JGd3MwmKBuM"         # VL Monitoring (All): TX_PVLS (D) Routine
PVLS_SUPPRESSED = "FloZph8hN9z"   # VL Monitoring (All): TX_PVLS (N) Routine
PVLS_DEN = "JGd3MwmKBuM"          # Same as Done (denominator for uptake)

# HIV Testing
HTS_TST_ENTRY_POINTS = [
    "ymKviaHZtQN", "vFlUDposW0Y", "XKAlilawdhN", "THJbtDzxplR",
    "Lwtqyjus0Mb", "QBsyLQZRdiH", "XYhYAMivUX5", "J4zibSjbBCt",
]
HTS_POSITIVE = "CcOr3MB7Mh4"
HTS_LINKED_WITHIN = ["wQ5AA7GTs9G", "YroUdlNVeR2", "h13L1gcUaCS"]
HTS_LINKED_OUTSIDE = ["DdPzCAtN3J2", "ZnetI7sd8Ub", "BeO9dmxTBMg"]

# PrEP
PREP_NEW = ["HmUEZ2yWtAE", "tSOqRYW3fUp", "CYLF8hUOHpv", "Q57YuHsnTKm",
            "OOhFACMqmKp", "hxfjIrnxHBF", "EmzN6C78vFE", "BSx4nKKwK1r",
            "mbSrJM6OvQo", "N3IsvP0sUF5", "DQR7sycvi6V", "JJsuQUWLYsD",
            "qvhr1STgYAD", "N6iP1PPLmyX", "EX7lZNXZXDe"]
PREP_CURR = ["UhOTGSCLcvz", "ENYVWNfmlWi", "m0sXEku2oeB", "McHzszUZFtf"]
PREP_SCREENED = ["Th1loMyxBhR", "C0z7kQZw2LZ", "dc0q1SbjyPU"]
PREP_NEW_PBFW = "EX7lZNXZXDe"     # PrEP New(PBFW )
PREP_NEW_PREG = "N6iP1PPLmyX"     # PrEP New(Preg)

# TB/HIV
TB_STAT_DEN = "QKXjusWFsgw"       # TB STAT Denominator (total TB cases) - 2858
TB_STAT_NUM = ["TNjfvn2OLAs", "ILx5Fy2Pkxj", "jTOkHMNFtrU"]  # Known Pos + Recent Neg + New Neg
TB_STAT_POS = "TNjfvn2OLAs"       # TB_STAT Known Positives - 261
TB_ART_NUM = ["LS1yYCAuHyA", "rWoEL18JGDx"]  # Already on ART + New on ART
TB_ART_DEN = "QKXjusWFsgw"        # Total TB (same as denominator) - 2858
HIV_TEST_TB = "XYhYAMivUX5"      # HTS_TST (facility) - TB Clinic - HIV Testing - 2321

# CD4
CD4_LESS200 = "Syg8KH15VW6"       # TX_New CD4<200
CD4_MORE200 = "gxEX3f1Wi4i"      # TX_New CD4>200
CD4_UNKNOWN = "r2X4WnVpKQG"      # TX_New CD4 unknown
TX_RTT_CD4_LT200 = "uFEG8nRwEe4"  # TX_RTT CD4 <200
TX_RTT_CD4_GT200 = "oyLoVOgSMsJ"  # TX_RTT CD4 >200

# TPT
TPT = "dysZutXWPTz"               # TPT TX_Curr Total

# PMTCT / ANC
ANC1_KNOWN_POS = "D3iDgpaDzzk"    # 1st ANC TX_Curr Known Positives
ANC1_NEW_POS = "SG48xQRmQa4"      # 1st ANC TX_Curr New Positives
PMTCT_STARTED_ART = "Az5iVPsEygj"  # 1st ANC PMTCT_ART TLD

# CACX / Cervical Cancer
CXCA_SCRN = "saKTnzr3iL0"        # CACX screen done - 1167
CXCA_SCRN_POS = "niWaZfcnBJ7"    # CACX Screen pos (0 - no system data)
CXCA_TX = ["fGL2FbQI5zr", "HVZNDpXCXUJ", "v2K3Be8fYsf"]  # thermo + cryo + leep

# IIT / Interruption in Treatment
IIT_TOTAL = "G9HTTIls3L6"         # Tx_ML, COD (IIT total)

# POST RAPE / GBV
POST_RAPE_PE = "VqKlOiHr48Y"      # GBV EV Tested - 174
POST_RAPE_SV = "jfFz99bXkrR"      # GBV EV Positive - 24
POST_RAPE_TOTAL = "IppugXeTcB8"   # GBV EV PVC (Post-Violence Care) - 1263

# SNS / Social Network Strategy
SNS_POS = "kxw6aLgI7Fj"           # HTS_TST_POS (Surge)
SNS_HRN_ELIGIBLE = "Sf8espZ1c2W"  # SNS (HRN) - Eligible for Test
SNS_HRN_LISTED = "x8jzStrfJad"    # SNS (HRN) - Listed Peers
SNS_HRN_TESTED = "MGZ0ACvFX2q"    # SNS (HRN) - Tested peers
SNS_HRN_POS = "JvjTd9JEF9j"       # SNS (HRN) - Peers tested positive
SNS_HRN_LINKED = "QswOWnPGVmv"    # SNS (HRN) - Peers linked to Treatment

# =====================================================================
# DHIS2 helper — uses closure functions passed during registration
# =====================================================================

_dhis2_fetch = None
_resolve_ou_ids = None

def _dhis2_fetch_safe(dx_ids, ou_id, pe="LAST_12_MONTHS", cocs=None):
    """Safe wrapper around app.py's _dhis2_fetch (closure)."""
    global _dhis2_fetch
    if _dhis2_fetch:
        return _dhis2_fetch(dx_ids, ou_id, pe, cocs)
    # Fallback: direct fetch
    return _direct_dhis2_fetch(dx_ids, ou_id, pe)


def _direct_dhis2_fetch(dx_ids, ou_id, pe="LAST_12_MONTHS"):
    """Direct DHIS2 analytics fetch fallback (no COC support)."""
    import requests as req
    from requests.auth import HTTPBasicAuth

    dx_str = ";".join(dx_ids) if isinstance(dx_ids, list) else dx_ids
    ou_str = ";".join(ou_id) if isinstance(ou_id, list) else ou_id

    dhis_base = os.getenv("DHIS_BASE_URL", "http://ereporting.chak.or.ke:8500/api/")
    url = (
        f"{dhis_base.rstrip('/')}/analytics.json?"
        f"dimension=dx:{dx_str}&dimension=pe:{pe}&dimension=ou:{ou_str}"
        f"&displayProperty=NAME"
    )
    username = os.getenv("DHIS_USERNAME", "Johnbrian")
    password = os.getenv("DHIS_PASSWORD", "JOHNb123\\")
    auth = HTTPBasicAuth(username, password)

    resp = req.get(url, auth=auth, timeout=120)
    if not resp.ok:
        return {}

    data = resp.json()
    hdrs = [h.get("name", "").lower() for h in data.get("headers", [])]
    pe_idx = next((i for i, h in enumerate(hdrs) if h in ("pe", "period")), 0)
    dx_idx = next((i for i, h in enumerate(hdrs) if h == "dx"), 0)
    val_idx = next((i for i, h in enumerate(hdrs) if h == "value"), len(hdrs) - 1)

    out = {}
    for row in data.get("rows", []):
        pe_name = str(row[pe_idx])
        val = float(row[val_idx]) if row[val_idx] else 0
        out[pe_name] = out.get(pe_name, 0) + val
    return out


def _resolve_ou_safe(county, subcounty=None, facility=None):
    """Safe wrapper around app.py's _resolve_ou_ids (closure)."""
    global _resolve_ou_ids
    if _resolve_ou_ids:
        return _resolve_ou_ids(county, subcounty, facility)
    return "Y52XNJ50hYb", False  # Meru fallback


def _period_sort_key(p):
    s = str(p)
    if len(s) >= 6:
        return (s[:4], s[4:6])
    return (s, "")


def _period_label(p):
    s = str(p)
    if len(s) == 6:
        month_names = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ]
        try:
            m = int(s[4:6])
            return f"{month_names[m-1]} {s[:4]}"
        except ValueError:
            return f"{s[:4]}-{s[4:]}"
    return s


# =====================================================================
# Multi-element fetch helper (parallel)
# =====================================================================

def _fetch_multi(specs, ou_id, pe="LAST_12_MONTHS"):
    """Fetch multiple DX groups in parallel.
    specs: list of (key, dx_ids_or_list)
    Returns {key: {period: value}}
    """
    results = {}
    errors = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        future_map = {}
        for key, dx in specs:
            fut = ex.submit(_dhis2_fetch_safe, dx, ou_id, pe)
            future_map[fut] = key
        for fut in as_completed(future_map):
            key = future_map[fut]
            try:
                results[key] = fut.result()
            except Exception as exc:
                errors.append(f"{key}: {exc}")
                results[key] = {}
    return results, errors


# =====================================================================
# BLUEPRINT DEFINITION
# =====================================================================

pbix_bp = Blueprint(
    "pbix",
    __name__,
    template_folder="templates",
    static_folder="static",
    url_prefix="/pbix",
)


# ── PAGE 1: PROFILE (Map) ──────────────────────────────────────────────
@pbix_bp.get("/api/profile")
def pbix_api_profile():
    """Return facility-level data for map and key indicators."""
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()

    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tx_curr", TX_CURR),
        ("tx_new", TX_NEW),
        ("hts_tested", HTS_TST_ENTRY_POINTS),
        ("hts_positive", HTS_POSITIVE),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        trend.append({
            "period": p,
            "label": _period_label(p),
            "tx_curr": round(float(results.get("tx_curr", {}).get(p, 0)), 1),
            "tx_new": round(float(results.get("tx_new", {}).get(p, 0)), 1),
            "hts_tested": round(float(results.get("hts_tested", {}).get(p, 0)), 1),
            "hts_positive": round(float(results.get("hts_positive", {}).get(p, 0)), 1),
        })

    latest = trend[-1] if trend else {}
    return jsonify({
        "page": "Profile",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "latest": latest,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 2: KEY INDICATORS DRILL DOWN ──────────────────────────────────
@pbix_bp.get("/api/key-indicators")
def pbix_api_key_indicators():
    """Return KPI dashboard data."""
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tx_curr", TX_CURR),
        ("tx_new", TX_NEW),
        ("pvls_eligible", PVLS_ELIGIBLE),
        ("pvls_done", PVLS_DONE),
        ("pvls_suppressed", PVLS_SUPPRESSED),
        ("hts_tested", HTS_TST_ENTRY_POINTS),
        ("hts_positive", HTS_POSITIVE),
        ("linked_within", HTS_LINKED_WITHIN),
        ("linked_outside", HTS_LINKED_OUTSIDE),
        ("cd4_less200", CD4_LESS200),
        ("cd4_more200", CD4_MORE200),
        ("tpt", TPT),
        ("tx_ml", TX_ML),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        tx_curr_v = float(results.get("tx_curr", {}).get(p, 0))
        tx_new_v = float(results.get("tx_new", {}).get(p, 0))
        pvls_d_v = float(results.get("pvls_done", {}).get(p, 0))
        pvls_s_v = float(results.get("pvls_suppressed", {}).get(p, 0))
        pvls_e_v = float(results.get("pvls_eligible", {}).get(p, 0))
        tested = float(results.get("hts_tested", {}).get(p, 0))
        positive = float(results.get("hts_positive", {}).get(p, 0))
        linked_w = float(results.get("linked_within", {}).get(p, 0))
        linked_o = float(results.get("linked_outside", {}).get(p, 0))
        total_linked = linked_w + linked_o
        cd4_lt = float(results.get("cd4_less200", {}).get(p, 0))
        cd4_mt = float(results.get("cd4_more200", {}).get(p, 0))
        cd4_total = cd4_lt + cd4_mt + float(results.get("cd4_unknown", {}).get(p, 0))
        tpt_v = float(results.get("tpt", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tx_curr": round(tx_curr_v, 1),
            "tx_new": round(tx_new_v, 1),
            "vl_uptake_pct": round(
                (pvls_d_v / tx_curr_v * 100) if tx_curr_v > 0 else 0, 1
            ),
            "vl_suppression_pct": round(
                (pvls_s_v / pvls_d_v * 100) if pvls_d_v > 0 else 0, 1
            ),
            "hts_tested": round(tested, 1),
            "hts_positive": round(positive, 1),
            "positivity_pct": round(
                (positive / tested * 100) if tested > 0 else 0, 1
            ),
            "linkage_pct": round(
                min(total_linked / positive * 100, 100.0) if positive > 0 else 0, 1
            ),
            "cd4_less200": round(cd4_lt, 1),
            "cd4_uptake_pct": round(
                (cd4_total / tx_new_v * 100) if tx_new_v > 0 else 0, 1
            ),
            "tpt": round(tpt_v, 1),
            "tpt_uptake_pct": round(
                (tpt_v / tx_curr_v * 100) if tx_curr_v > 0 else 0, 1
            ),
        })

    latest = trend[-1] if trend else {}
    return jsonify({
        "page": "Key Indicators Drill Down",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "latest": latest,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 3: PrEP ──────────────────────────────────────────────────────
@pbix_bp.get("/api/prep")
def pbix_api_prep():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("prep_new", PREP_NEW),
        ("prep_curr", PREP_CURR),
        ("prep_screened", PREP_SCREENED),
        ("prep_new_pbfw", PREP_NEW_PBFW),
        ("prep_new_preg", PREP_NEW_PREG),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        new_v = float(results.get("prep_new", {}).get(p, 0))
        curr_v = float(results.get("prep_curr", {}).get(p, 0))
        screened_v = float(results.get("prep_screened", {}).get(p, 0))
        new_pbfw = float(results.get("prep_new_pbfw", {}).get(p, 0))
        new_preg = float(results.get("prep_new_preg", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "prep_new": round(new_v, 1),
            "prep_curr": round(curr_v, 1),
            "prep_screened": round(screened_v, 1),
            "prep_new_pbfw": round(new_pbfw, 1),
            "prep_new_preg": round(new_preg, 1),
            "prep_uptake_pct": round(
                (new_v / screened_v * 100) if screened_v > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "PrEP",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 4: HTS PERFORMANCE ───────────────────────────────────────────
@pbix_bp.get("/api/hts-performance")
def pbix_api_hts_performance():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tested", HTS_TST_ENTRY_POINTS),
        ("positive", HTS_POSITIVE),
        ("linked_w", HTS_LINKED_WITHIN),
        ("linked_o", HTS_LINKED_OUTSIDE),
        ("tx_new", TX_NEW),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        tested = float(results.get("tested", {}).get(p, 0))
        positive = float(results.get("positive", {}).get(p, 0))
        lw = float(results.get("linked_w", {}).get(p, 0))
        lo = float(results.get("linked_o", {}).get(p, 0))
        tx_new_v = float(results.get("tx_new", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tested": round(tested, 1),
            "positive": round(positive, 1),
            "linked_within": round(lw, 1),
            "linked_outside": round(lo, 1),
            "total_linked": round(lw + lo, 1),
            "positivity_pct": round(
                (positive / tested * 100) if tested > 0 else 0, 1
            ),
            "linkage_pct": round(
                min((lw + lo) / positive * 100, 100.0) if positive > 0 else 0, 1
            ),
            "tx_new": round(tx_new_v, 1),
        })

    return jsonify({
        "page": "HTS Performance",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 5: HTS INDEX TESTING ─────────────────────────────────────────
@pbix_bp.get("/api/hts-index")
def pbix_api_hts_index():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tested", HTS_TST_ENTRY_POINTS),
        ("positive", HTS_POSITIVE),
        ("linked_w", HTS_LINKED_WITHIN),
        ("linked_o", HTS_LINKED_OUTSIDE),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        tested = float(results.get("tested", {}).get(p, 0))
        positive = float(results.get("positive", {}).get(p, 0))
        lw = float(results.get("linked_w", {}).get(p, 0))
        lo = float(results.get("linked_o", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tested": round(tested, 1),
            "positive": round(positive, 1),
            "linked": round(lw + lo, 1),
            "positivity_pct": round(
                (positive / tested * 100) if tested > 0 else 0, 1
            ),
            "linkage_pct": round(
                min((lw + lo) / positive * 100, 100.0) if positive > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "HTS Index Testing",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 6: SNS CASCADE ──────────────────────────────────────────────
@pbix_bp.get("/api/sns-cascade")
def pbix_api_sns():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("sns_pos", SNS_POS),
        ("sns_hrn_eligible", SNS_HRN_ELIGIBLE),
        ("sns_hrn_listed", SNS_HRN_LISTED),
        ("sns_hrn_tested", SNS_HRN_TESTED),
        ("sns_hrn_pos", SNS_HRN_POS),
        ("sns_hrn_linked", SNS_HRN_LINKED),
        ("linked_w", HTS_LINKED_WITHIN),
        ("linked_o", HTS_LINKED_OUTSIDE),
        ("tx_new", TX_NEW),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        pos = float(results.get("sns_pos", {}).get(p, 0))
        lw = float(results.get("linked_w", {}).get(p, 0))
        lo = float(results.get("linked_o", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "sns_pos": round(pos, 1),
            "sns_hrn_eligible": round(float(results.get("sns_hrn_eligible", {}).get(p, 0)), 1),
            "sns_hrn_listed": round(float(results.get("sns_hrn_listed", {}).get(p, 0)), 1),
            "sns_hrn_tested": round(float(results.get("sns_hrn_tested", {}).get(p, 0)), 1),
            "sns_hrn_pos": round(float(results.get("sns_hrn_pos", {}).get(p, 0)), 1),
            "sns_hrn_linked": round(float(results.get("sns_hrn_linked", {}).get(p, 0)), 1),
            "linked": round(lw + lo, 1),
            "tx_new": round(float(results.get("tx_new", {}).get(p, 0)), 1),
        })

    return jsonify({
        "page": "SNS Cascade",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 7: CARE AND TREATMENT ────────────────────────────────────────
@pbix_bp.get("/api/care-treatment")
def pbix_api_care_treatment():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tx_curr", TX_CURR),
        ("tx_new", TX_NEW),
        ("tx_ml", TX_ML),
        ("tx_rtt", TX_RTT),
        ("rtt_cd4_lt200", TX_RTT_CD4_LT200),
        ("rtt_cd4_gt200", TX_RTT_CD4_GT200),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        curr = float(results.get("tx_curr", {}).get(p, 0))
        new = float(results.get("tx_new", {}).get(p, 0))
        ml = float(results.get("tx_ml", {}).get(p, 0))
        rtt = float(results.get("tx_rtt", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tx_curr": round(curr, 1),
            "tx_new": round(new, 1),
            "tx_ml": round(ml, 1),
            "tx_rtt": round(rtt, 1),
            "rtt_cd4_lt200": round(float(results.get("rtt_cd4_lt200", {}).get(p, 0)), 1),
            "rtt_cd4_gt200": round(float(results.get("rtt_cd4_gt200", {}).get(p, 0)), 1),
            "rtt_cd4_total": round(float(results.get("rtt_cd4_lt200", {}).get(p, 0)) + float(results.get("rtt_cd4_gt200", {}).get(p, 0)), 1),
            "iit_pct": round(
                (ml / curr * 100) if curr > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "Care and Treatment",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 8: CD4/TPT UPTAKE ────────────────────────────────────────────
@pbix_bp.get("/api/cd4-tpt")
def pbix_api_cd4_tpt():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tx_curr", TX_CURR),
        ("tx_new", TX_NEW),
        ("cd4_lt200", CD4_LESS200),
        ("cd4_gt200", CD4_MORE200),
        ("cd4_unk", CD4_UNKNOWN),
        ("rtt_cd4_lt", TX_RTT_CD4_LT200),
        ("rtt_cd4_gt", TX_RTT_CD4_GT200),
        ("tpt", TPT),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        tx_curr_v = float(results.get("tx_curr", {}).get(p, 0))
        tx_new_v = float(results.get("tx_new", {}).get(p, 0))
        cd4_lt = float(results.get("cd4_lt200", {}).get(p, 0))
        cd4_gt = float(results.get("cd4_gt200", {}).get(p, 0))
        cd4_unk = float(results.get("cd4_unk", {}).get(p, 0))
        cd4_total = cd4_lt + cd4_gt + cd4_unk
        rtt_lt = float(results.get("rtt_cd4_lt", {}).get(p, 0))
        rtt_gt = float(results.get("rtt_cd4_gt", {}).get(p, 0))
        tpt_v = float(results.get("tpt", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tx_new": round(tx_new_v, 1),
            "cd4_less200": round(cd4_lt, 1),
            "cd4_more200": round(cd4_gt, 1),
            "cd4_unknown": round(cd4_unk, 1),
            "cd4_total": round(cd4_total, 1),
            "cd4_uptake_pct": round(
                (cd4_total / tx_new_v * 100) if tx_new_v > 0 else 0, 1
            ),
            "pct_cd4_less200": round(
                (cd4_lt / cd4_total * 100) if cd4_total > 0 else 0, 1
            ),
            "rtt_cd4_less200": round(rtt_lt, 1),
            "rtt_cd4_more200": round(rtt_gt, 1),
            "tpt": round(tpt_v, 1),
            "tpt_uptake_pct": round(
                (tpt_v / tx_curr_v * 100) if tx_curr_v > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "CD4/TPT Uptake",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 9: VIRAL LOAD CASCADE ────────────────────────────────────────
@pbix_bp.get("/api/vl-cascade")
def pbix_api_vl_cascade():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tx_curr", TX_CURR),
        ("tx_new", TX_NEW),
        ("pvls_eligible", PVLS_ELIGIBLE),
        ("pvls_done", PVLS_DONE),
        ("pvls_suppressed", PVLS_SUPPRESSED),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        curr = float(results.get("tx_curr", {}).get(p, 0))
        new_v = float(results.get("tx_new", {}).get(p, 0))
        eligible = float(results.get("pvls_eligible", {}).get(p, 0))
        done = float(results.get("pvls_done", {}).get(p, 0))
        suppressed = float(results.get("pvls_suppressed", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tx_curr": round(curr, 1),
            "tx_new": round(new_v, 1),
            "pvls_eligible": round(eligible, 1),
            "pvls_done": round(done, 1),
            "pvls_suppressed": round(suppressed, 1),
            "vl_uptake_pct": round(
                (done / curr * 100) if curr > 0 else 0, 1
            ),
            "vl_suppression_pct": round(
                (suppressed / done * 100) if done > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "Viral Load Cascade",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 10: PMTCT ────────────────────────────────────────────────────
@pbix_bp.get("/api/pmtct")
def pbix_api_pmtct():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("anc1_known_pos", ANC1_KNOWN_POS),
        ("anc1_new_pos", ANC1_NEW_POS),
        ("pmtct_started_art", PMTCT_STARTED_ART),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        known = float(results.get("anc1_known_pos", {}).get(p, 0))
        new_pos = float(results.get("anc1_new_pos", {}).get(p, 0))
        started_art = float(results.get("pmtct_started_art", {}).get(p, 0))
        total_pos = known + new_pos

        trend.append({
            "period": p,
            "label": _period_label(p),
            "anc1_known_pos": round(known, 1),
            "anc1_new_pos": round(new_pos, 1),
            "total_pos": round(total_pos, 1),
            "started_art": round(started_art, 1),
            "pmtct_uptake_pct": round(
                (started_art / total_pos * 100) if total_pos > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "PMTCT",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 11: TB ───────────────────────────────────────────────────────
@pbix_bp.get("/api/tb")
def pbix_api_tb():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tb_stat_den", TB_STAT_DEN),
        ("tb_stat_num", TB_STAT_NUM),
        ("tb_stat_pos", TB_STAT_POS),
        ("tb_art_num", TB_ART_NUM),
        ("tb_art_den", TB_ART_DEN),
        ("hiv_test_tb", HIV_TEST_TB),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        sden = float(results.get("tb_stat_den", {}).get(p, 0))
        snum = float(results.get("tb_stat_num", {}).get(p, 0))
        spos = float(results.get("tb_stat_pos", {}).get(p, 0))
        art_num = float(results.get("tb_art_num", {}).get(p, 0))
        art_den = float(results.get("tb_art_den", {}).get(p, 0))
        hiv_test = float(results.get("hiv_test_tb", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tb_screened": round(snum, 1),
            "tb_presumptive": round(sden, 1),
            "tb_pos": round(spos, 1),
            "tb_on_art": round(art_num, 1),
            "tb_art_uptake_pct": round(
                (art_num / art_den * 100) if art_den > 0 else 0, 1
            ),
            "tb_positivity_pct": round(
                (spos / snum * 100) if snum > 0 else 0, 1
            ),
            "hiv_test_tb": round(hiv_test, 1),
        })

    return jsonify({
        "page": "TB",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 12: POST RAPE (POST RESP) ────────────────────────────────────
@pbix_bp.get("/api/post-rape")
def pbix_api_post_rape():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("pe", POST_RAPE_PE),
        ("sv", POST_RAPE_SV),
        ("total", POST_RAPE_TOTAL),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        pe_v = float(results.get("pe", {}).get(p, 0))
        sv_v = float(results.get("sv", {}).get(p, 0))
        total_v = float(results.get("total", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "physical_emotional": round(pe_v, 1),
            "sexual_violence": round(sv_v, 1),
            "total": round(total_v, 1),
        })

    return jsonify({
        "page": "POST RESP",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 13: CACX (Cervical Cancer) ───────────────────────────────────
@pbix_bp.get("/api/cacx")
def pbix_api_cacx():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("cxca_scrn", CXCA_SCRN),
        ("cxca_pos", CXCA_SCRN_POS),
        ("cxca_tx", CXCA_TX),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        scrn = float(results.get("cxca_scrn", {}).get(p, 0))
        pos = float(results.get("cxca_pos", {}).get(p, 0))
        tx = float(results.get("cxca_tx", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "screened": round(scrn, 1),
            "positive": round(pos, 1),
            "treated": round(tx, 1),
            "positivity_pct": round(
                (pos / scrn * 100) if scrn > 0 else 0, 1
            ),
            "treatment_pct": round(
                (tx / pos * 100) if pos > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "CACX",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 14: IIT QUARTERLY ────────────────────────────────────────────
@pbix_bp.get("/api/iit-quarterly")
def pbix_api_iit():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tx_curr", TX_CURR),
        ("tx_ml", TX_ML),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        curr = float(results.get("tx_curr", {}).get(p, 0))
        ml = float(results.get("tx_ml", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tx_curr": round(curr, 1),
            "tx_ml": round(ml, 1),
            "iit_pct": round(
                (ml / curr * 100) if curr > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "IIT Quarterly",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 15: HTS (Summary) ────────────────────────────────────────────
@pbix_bp.get("/api/hts-summary")
def pbix_api_hts_summary():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tested", HTS_TST_ENTRY_POINTS),
        ("positive", HTS_POSITIVE),
        ("tx_new", TX_NEW),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        tested = float(results.get("tested", {}).get(p, 0))
        positive = float(results.get("positive", {}).get(p, 0))
        tx_new_v = float(results.get("tx_new", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tested": round(tested, 1),
            "positive": round(positive, 1),
            "tx_new": round(tx_new_v, 1),
            "positivity_pct": round(
                (positive / tested * 100) if tested > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "HTS",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 16.5: LINKAGE (HTS Linkage page) ────────────────────────────
@pbix_bp.get("/api/linkage")
def pbix_api_linkage():
    """Return HTS linkage data: tested → positive → linked → tx_new cascade."""
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tested", HTS_TST_ENTRY_POINTS),
        ("positive", HTS_POSITIVE),
        ("linked_w", HTS_LINKED_WITHIN),
        ("linked_o", HTS_LINKED_OUTSIDE),
        ("tx_new", TX_NEW),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        tested = float(results.get("tested", {}).get(p, 0))
        positive = float(results.get("positive", {}).get(p, 0))
        lw = float(results.get("linked_w", {}).get(p, 0))
        lo = float(results.get("linked_o", {}).get(p, 0))
        tx_new_v = float(results.get("tx_new", {}).get(p, 0))
        total_linked = lw + lo

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tested": round(tested, 1),
            "positive": round(positive, 1),
            "linked_within": round(lw, 1),
            "linked_outside": round(lo, 1),
            "total_linked": round(total_linked, 1),
            "tx_new": round(tx_new_v, 1),
            "positivity_pct": round(
                (positive / tested * 100) if tested > 0 else 0, 1
            ),
            "linkage_pct": round(
                min(total_linked / positive * 100, 100.0) if positive > 0 else 0, 1
            ),
            "tx_new_pct": round(
                min(tx_new_v / positive * 100, 100.0) if positive > 0 else 0, 1
            ),
        })

    # Also create cascade summary (latest period)
    latest = trend[-1] if trend else {}
    cascade_categories = ["Tested", "Positive", "Linked", "TX_NEW"]
    cascade_values = [
        round(latest.get("tested", 0), 1),
        round(latest.get("positive", 0), 1),
        round(latest.get("total_linked", 0), 1),
        round(latest.get("tx_new", 0), 1),
    ]

    return jsonify({
        "page": "Linkage",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "latest": latest,
        "cascade": {
            "categories": cascade_categories,
            "values": cascade_values,
        },
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── PAGE 16: TESTING PER MODALITY ─────────────────────────────────────
@pbix_bp.get("/api/testing-modality")
def pbix_api_modality():
    county = request.args.get("county", "Meru County").strip()
    subcounty = request.args.get("subcounty", "").strip() or None
    facility = request.args.get("facility", "").strip() or None
    pe = request.args.get("period", "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_safe(county, subcounty, facility)

    results, errors = _fetch_multi([
        ("tested", HTS_TST_ENTRY_POINTS),
        ("positive", HTS_POSITIVE),
        ("tx_new", TX_NEW),
    ], ou_id, pe)

    all_periods = sorted(
        set().union(*[d.keys() for d in results.values()]),
        key=_period_sort_key,
    )

    trend = []
    for p in all_periods:
        tested = float(results.get("tested", {}).get(p, 0))
        positive = float(results.get("positive", {}).get(p, 0))
        tx_new_v = float(results.get("tx_new", {}).get(p, 0))

        trend.append({
            "period": p,
            "label": _period_label(p),
            "tested": round(tested, 1),
            "positive": round(positive, 1),
            "tx_new": round(tx_new_v, 1),
            "yield_pct": round(
                (positive / tested * 100) if tested > 0 else 0, 1
            ),
        })

    return jsonify({
        "page": "Testing per Modality",
        "county": county,
        "source": "dhis2_live",
        "period_range": pe,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors or None,
    })


# ── MASTER DASHBOARD HTML PAGE ────────────────────────────────────────
@pbix_bp.get("/dashboard")
def pbix_dashboard():
    """Render the master PBIX dashboard with all 16 pages as sub-tabs."""
    return render_template("pbix_dashboard.html")


# ── ALL PAGES LIST ENDPOINT ───────────────────────────────────────────
@pbix_bp.get("/api/pages")
def pbix_api_pages():
    """Return grouped page list for hierarchical tab navigation.

    Pages are organized into parent groups (HIV Testing, HIV Treatment)
    and standalone tabs. This enables a two-level tab navigation in the UI.
    """
    return jsonify({
        "groups": [
            {
                "id": "hiv-testing",
                "label": "HIV Testing",
                "icon": "vial-virus",
                "children": [
                    {"id": "hts-performance", "label": "HTS Performance", "icon": "vial"},
                    {"id": "hts-index", "label": "HTS Index Testing", "icon": "users"},
                    {"id": "sns-cascade", "label": "SNS Cascade", "icon": "share-nodes"},
                    {"id": "hts-summary", "label": "HTS Summary", "icon": "microscope"},
                    {"id": "testing-modality", "label": "Testing Modality", "icon": "layer-group"},
                ],
            },
            {
                "id": "hiv-treatment",
                "label": "HIV Treatment",
                "icon": "heart-pulse",
                "children": [
                    {"id": "key-indicators", "label": "Key Indicators", "icon": "gauge"},
                    {"id": "care-treatment", "label": "Care & Treatment", "icon": "heart-pulse"},
                    {"id": "cd4-tpt", "label": "CD4/TPT Uptake", "icon": "flask"},
                    {"id": "vl-cascade", "label": "Viral Load Cascade", "icon": "chart-line"},
                    {"id": "iit-quarterly", "label": "IIT Quarterly", "icon": "triangle-exclamation"},
                ],
            },
            {"id": "profile", "label": "Profile", "icon": "map", "standalone": True},
            {"id": "prep", "label": "PrEP", "icon": "shield", "standalone": True},
            {"id": "pmtct", "label": "PMTCT", "icon": "baby", "standalone": True},
            {"id": "tb", "label": "TB", "icon": "lungs", "standalone": True},
            {"id": "post-rape", "label": "Post Rape", "icon": "hand", "standalone": True},
            {"id": "cacx", "label": "CACX", "icon": "ribbon", "standalone": True},
            {"id": "linkage", "label": "Linkage", "icon": "link", "standalone": True},
        ],
    })


# =====================================================================
# REGISTRATION HELPER
# =====================================================================

def register_pbix_blueprint(app: Flask, dhis2_fetch=None, resolve_ou_ids=None) -> None:
    """Register the PBIX dashboard blueprint on the Flask app.
    
    Receives closure functions from app.py's create_app() so they
    can be used by the blueprint routes.
    """
    global _dhis2_fetch, _resolve_ou_ids
    if dhis2_fetch:
        _dhis2_fetch = dhis2_fetch
    if resolve_ou_ids:
        _resolve_ou_ids = resolve_ou_ids

    app.register_blueprint(pbix_bp)
    print(f"[PBIX] Registered PBIX dashboard blueprint")

    # Also register the page list endpoint on the main app for frontend
    @app.get("/api/pbix/pages")
    def _pbix_pages():
        return pbix_api_pages()

    # Also expose flat page list for backward compat / URL param routing
    @app.get("/api/pbix/pages-flat")
    def _pbix_pages_flat():
        """Return flat list of all page IDs for URL param validation."""
        groups = pbix_api_pages().json["groups"]
        flat = []
        for g in groups:
            if g.get("standalone"):
                flat.append(g)
            else:
                for c in g.get("children", []):
                    flat.append(c)
        return jsonify({"pages": flat})
