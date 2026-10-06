"""Milestone Tracker: CHAK Daraka FAA monthly milestone plan + payment schedule.

Parses local workbooks (in train/):
  1. FAA_Monthly_Milestone_Plan_w_PaySched_CHAK_Revised.xlsx
     - Milestones_DataEntry  (master registry, unique Milestone IDs 1-26)
     - Payment Schedule_M1 .. M5  (per-month payment schedules)
     - V2 Payment Schedule_Final Pay  (Month-6 / final-pay schedule)
  2. Milestones Summary2.xlsx  (Summary2-style tracker layout + M1 seeds)
  3. UJTP DWAPI UPLOADS*.xlsx  (NDWH per-facility electronic-upload log;
     supplies the #22 reporting-coverage reading on the Baseline tab)

Milestones 6-9, 11, 14, 15, 16 and 21 are measured from CHAK DHIS2 MOH 731
returns (and KHIS national commodity returns for #21).  #22 is measured
from the NDWH upload workbook above instead — see _dwapi_coverage().

Serves a single read-only API:  GET /api/milestone/data
"""
from __future__ import annotations

import copy
import csv
import json
import os
import re
import threading
import time
from datetime import date, datetime

import openpyxl
from flask import Blueprint, jsonify, request

from services.paths import BASE_DIR

milestone_bp = Blueprint("milestone", __name__)

_app = None  # set by register_milestone_blueprint

# ── Module-level cache (parsed once, reused across requests) ──
_MILESTONE_CACHE = None
_MILESTONE_CACHE_AT = 0.0
# Auto-refresh the live CHAK DHIS2 (MOH 731) baseline this often so the
# tracker picks up new data-entry without a Flask restart.  Override with
# env MILESTONE_CACHE_TTL (seconds).  The underlying analytics layer also
# caches per-data-element for 300 s, so the real DHIS2 pull cadence is
# ~max(TTL, 300 s) per element.
_MILESTONE_TTL = int(os.getenv("MILESTONE_CACHE_TTL", "300"))

# Serialises payload builds.  Without it the boot pre-warm and the first
# incoming request (or two concurrent requests) each load both workbooks
# and hit CHAK DHIS2 at the same time — the quickest way to blow the
# memory budget of a 512 MB Render instance.
_BUILD_LOCK = threading.Lock()
_PREWARM_STARTED = False

# Guards the "start a background refresh?" decision so two concurrent cold
# requests cannot each spawn their own builder.
_REFRESH_DECISION_LOCK = threading.Lock()

# Seconds a client should wait before re-polling while a cold build runs.
_WARMING_RETRY_SECONDS = int(os.getenv("MILESTONE_WARMING_RETRY", "5"))

# ── Baseline anchor (the Baseline tab's month) ──────────────────────────
# The Baseline tab is a DELIBERATE freeze, not a moving target.  It is
# pinned to one calendar month here and stays on it until this line is
# changed by hand — it does NOT follow whichever month last received data.
#
# Why the pin: the anchor used to be "the latest month with any non-zero
# value".  That reads correctly while exactly one month is complete, but the
# moment a single facility submits one September return, September becomes
# the latest month and the headline baseline silently drops from a
# 259-facility August read to a one-facility September read.  The arithmetic
# stays honest and ≤100%, but the number is not a baseline any more and it
# can flip the payment band — so the whole panel would lurch on one site's
# data entry.
#
# Format: DHIS2 period id 'YYYYMM' (e.g. '202608' = August 2026).  A month
# NAME also works ('August 2026').  Set it to "" to restore the old
# auto-follow behaviour.  Env override: MILESTONE_BASELINE_PERIOD.
_BASELINE_PERIOD = os.getenv("MILESTONE_BASELINE_PERIOD", "202608").strip()

FAA_XLSX = BASE_DIR / "FAA_Monthly_Milestone_Plan_w_PaySched_CHAK_Revised.xlsx"
SUMMARY2_XLSX = BASE_DIR / "Milestones Summary2.xlsx"

# ── Milestone 22 — electronic-reporting coverage (NDWH / DWAPI) ─────────
# The NDWH produces this upload workbook as a dated snapshot, and the
# filename carries a version suffix ("UJTP DWAPI UPLOADS-August 2026 (3)
# .xlsx").  It is therefore GLOBBED and the newest match wins, so dropping
# next month's file into train/ is enough — no code change, no redeploy.
DWAPI_GLOB = "UJTP DWAPI UPLOADS*.xlsx"
# Sheet carrying the expected-facility roster the milestone is scored against.
_DWAPI_ROSTER_SHEET = "ndwh_"
# Sheet carrying the per-facility upload log.  A workbook that renames it
# still parses: any sheet whose header row holds both 'code' and 'updated' is
# accepted as the log.
_DWAPI_DATA_SHEET = "Data"

# Payment-status values a milestone row can take (Summary2 seeds only).
_STATUS_SET = {"Fully Paid", "Partially Paid", "Not Paid"}
_ALERT_SET = {"On Track", "Watch", "Off Track"}
# Summary2 columns that are pure placeholders (never surfaced as real data).
_PLACEHOLDER_SET = {"%", "$$$", "$$$$", "$$", "$", "Yes/No", ""}


def register_milestone_blueprint(app):
    global _app
    _app = app
    app.register_blueprint(milestone_bp)
    print("[MILESTONE] Blueprint registered")
    _start_prewarm()


def _start_prewarm():
    """Warm the payload cache in a daemon thread at boot.

    A cold build loads both FAA workbooks and pulls LAST_12_MONTHS of
    MOH 731 for all 259 Daraja org units from CHAK DHIS2 in one analytics
    call (measured ~47 s locally, materially slower on a shared Render
    CPU).  Running that inside the first browser request exceeded the
    gunicorn worker timeout, Render answered 502, and the tracker page
    showed "Failed to load milestone data".  Pre-warming moves the cost
    off the request path so the first user request is a cache hit.

    The thread is a daemon: a failed warm-up must never block or crash
    boot, and the request path still rebuilds on demand if it is missed.
    """
    global _PREWARM_STARTED
    if _PREWARM_STARTED:
        return
    _PREWARM_STARTED = True

    def _warm():
        # Let the WSGI server finish binding and answer the platform's
        # first health checks before we start parsing Excel and hitting
        # CHAK DHIS2, so a slow warm-up can never be mistaken for a
        # failed boot and trigger a restart loop.
        time.sleep(float(os.getenv("MILESTONE_PREWARM_DELAY", "10")))
        t0 = time.time()
        try:
            # Build under the lock ourselves.  _ensure_payload() is now
            # deliberately non-blocking (it answers "warming" rather than
            # waiting on a cold build), so the pre-warm must not route
            # through it — here we *want* to pay the build cost.
            with _BUILD_LOCK:
                if not _fresh(_MILESTONE_CACHE, _MILESTONE_CACHE_AT):
                    _build_locked()
            print(f"[MILESTONE] Pre-warm complete in {time.time() - t0:.1f}s")
        except Exception as exc:  # noqa: BLE001
            print(f"[MILESTONE] Pre-warm failed after "
                  f"{time.time() - t0:.1f}s: {exc}")

    threading.Thread(
        target=_warm, name="milestone-prewarm", daemon=True
    ).start()


# ── Small helpers ────────────────────────────────────────────────────
def _clean(value):
    """Collapse whitespace/newlines in a milestone name, strip edges."""
    if value is None:
        return ""
    text = str(value)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class _ValueCell:
    """Stand-in for an openpyxl Cell that only exposes .value."""

    __slots__ = ("value",)

    def __init__(self, value):
        self.value = value


class _SheetView:
    """Read a worksheet as plain values instead of openpyxl Cell objects.

    Loading eagerly with ``openpyxl.load_workbook()`` materialises a Cell
    instance per non-empty cell.  The FAA workbook's five ~4,000-row
    payment schedules alone cost ~120 MB of RSS that way, which is a large
    share of a 512 MB Render instance for data we immediately convert to
    ints and strings.

    This wraps a ``read_only=True`` worksheet, materialises each row once
    with ``values_only=True``, and re-exposes the tiny slice of the
    worksheet API the parsers use: ``max_row`` and ``cell(r, c).value``.
    Out-of-range reads return an empty cell rather than raising, which
    matches how the parsers already treat blank trailing columns.
    """

    __slots__ = ("_rows", "max_row")

    def __init__(self, ws):
        self._rows = [tuple(r) for r in ws.iter_rows(values_only=True)]
        self.max_row = len(self._rows)

    def cell(self, row, column):
        if 1 <= row <= self.max_row:
            values = self._rows[row - 1]
            if 1 <= column <= len(values):
                return _ValueCell(values[column - 1])
        return _ValueCell(None)


def _open_for_values(path, sheets, *, read_only):
    """Open `path` and return {sheet_name: worksheet} for `sheets`.

    With ``read_only=True`` the returned views can be used after the
    workbook is closed because the rows are already materialised.
    """
    wb = openpyxl.load_workbook(path, data_only=True, read_only=read_only)
    try:
        out = {}
        for name in sheets:
            if name not in wb.sheetnames:
                continue
            ws = wb[name]
            out[name] = _SheetView(ws) if read_only else ws
        return out
    finally:
        if read_only:
            wb.close()


def _iso(value):
    """datetime/date -> 'YYYY-MM-DD' string (else None)."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return None


def _num(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value) if float(value).is_integer() else round(float(value), 2)
    return None


def _find_header_row(ws, col=1):
    """Scan first rows for a header whose `col` equals 'Milestone ID'."""
    for r in range(1, min(12, ws.max_row + 1)):
        if _clean(ws.cell(r, col).value).lower() == "milestone id":
            return r
    return None


def _row_numeric_in_label_row(ws, header_row, label_key):
    """Scan rows above header for label_key in col B; return the numeric cell
    found anywhere in that row, else None."""
    for r in range(1, header_row):
        label = _clean(ws.cell(r, 2).value)
        if label_key in label.upper():
            for c in range(1, 20):
                v = ws.cell(r, c).value
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    return v
    return None


def _parse_months_schedule(ws, key, sheet_name):
    """Parse a Payment Schedule_M1..M5 sheet into a month dict.

    Column layout (A..K):
      A=Milestone ID, B=ID, C=Milestone Name, D=Type/Tier, E=Frequency,
      F=Threshold, G=Tiered Payment, H=Max Monthly Payment,
      I=Suggested Estimated Due Date, J=Hide-Original Due Date,
      K=REQUIRED Partner Finalized Due Date.
    """
    header_row = _find_header_row(ws)
    if not header_row:
        return None

    rows = []
    r = header_row + 1
    while r <= ws.max_row:
        mid = ws.cell(r, 1).value
        if not isinstance(mid, (int, float)) or isinstance(mid, bool):
            break
        rows.append(
            {
                "id": int(mid),
                "name": _clean(ws.cell(r, 3).value),
                "tier": _clean(ws.cell(r, 4).value),
                "frequency": _clean(ws.cell(r, 5).value),
                "threshold": _clean(ws.cell(r, 6).value),
                "tieredPayment": _clean(ws.cell(r, 7).value),
                "amount": _num(ws.cell(r, 8).value),
                "suggestedDue": _iso(ws.cell(r, 9).value),
                "requiredDue": _iso(ws.cell(r, 11).value),
            }
        )
        r += 1

    period = ""
    for rr in range(1, header_row):
        label = _clean(ws.cell(rr, 2).value)
        if "month" in label.lower() and ":" in label and "20" in label:
            period = label
            break

    total = _row_numeric_in_label_row(ws, header_row, "TOTAL PAYMENT FOR")
    cumulative = _row_numeric_in_label_row(ws, header_row, "TOTAL CUMULATIVE")
    if total is None:
        total = sum(x["amount"] or 0 for x in rows)
    if cumulative is None:
        cumulative = total

    return {
        "key": key,
        "sheet": sheet_name,
        "period": period,
        "total": total,
        "cumulative": cumulative,
        "count": len(rows),
        "isFinalPay": False,
        "rows": rows,
    }


def _parse_v2_final_pay(ws):
    """Parse 'V2 Payment Schedule_Final Pay' as the Month-6 tab.

    Column layout (A..N):
      A=Milestone ID, B=ID, C=Milestone Name, D=Type/Tier, E=Frequency,
      F=Threshold, G=Tiered Payment, H=Max Annual Payment,
      I=Sum of Prior Months (desc), J=Final Payment (desc),
      K=Month Final Payment Occuring ('M5'/'M6'), L=Estimated Due Date,
      M=Hide, N=REQUIRED Partner Finalized Due Date.
    """
    header_row = _find_header_row(ws)
    if not header_row:
        return None

    rows = []
    r = header_row + 1
    while r <= ws.max_row:
        mid = ws.cell(r, 1).value
        if not isinstance(mid, (int, float)) or isinstance(mid, bool):
            break
        rows.append(
            {
                "id": int(mid),
                "name": _clean(ws.cell(r, 3).value),
                "tier": _clean(ws.cell(r, 4).value),
                "frequency": _clean(ws.cell(r, 5).value),
                "threshold": _clean(ws.cell(r, 6).value),
                "tieredPayment": _clean(ws.cell(r, 7).value),
                "amount": _num(ws.cell(r, 8).value),  # Max Annual Payment
                "finalMonth": _clean(ws.cell(r, 11).value),  # M5 / M6
                "suggestedDue": _iso(ws.cell(r, 12).value),
                "requiredDue": _iso(ws.cell(r, 14).value),
            }
        )
        r += 1

    cumulative = _row_numeric_in_label_row(ws, header_row, "TOTAL CUMULATIVE")
    total = _row_numeric_in_label_row(ws, header_row, "TOTAL PAYMENT FOR")
    if cumulative is None:
        cumulative = sum(x["amount"] or 0 for x in rows)
    if total is None:
        total = 0  # final pay amounts are performance-tiered text, not fixed

    return {
        "key": "M6",
        "sheet": "V2 Payment Schedule_Final Pay",
        "period": "Final Payment - Month 6 (Year 1 Close-Out)",
        "total": total,
        "cumulative": cumulative,
        "count": len(rows),
        "isFinalPay": True,
        "rows": rows,
    }


def _parse_master_registry(ws):
    """Parse Milestones_DataEntry master registry -> {id: {...}}.

    Header row contains 'Milestone ID' in col B.  Per-milestone facts used by
    the tracker: cleaned name, Type/Tier (W), and Max Annual Payment (U).
    """
    header_row = None
    for r in range(1, min(6, ws.max_row + 1)):
        if _clean(ws.cell(r, 2).value).lower() == "milestone id":
            header_row = r
            break
    master = {}
    if not header_row:
        return master
    r = header_row + 1
    while r <= ws.max_row:
        mid = ws.cell(r, 2).value
        if not isinstance(mid, (int, float)) or isinstance(mid, bool):
            break
        master[int(mid)] = {
            "id": int(mid),
            "name": _clean(ws.cell(r, 3).value),
            "allocation": _num(ws.cell(r, 21).value),  # U = Max Annual Payment
            "milestoneType": _clean(ws.cell(r, 23).value),  # W = PM/Tier 1/2
        }
        r += 1
    return master


def _parse_summary2(ws):
    """Parse Milestones Summary2 -> {milestone_id: tracker_seed}.

    Layout rows 9/10 headers; rows 11-36 = milestone IDs 1-26.
      A=ID, B=Milestone, C=6-Month Allocation, D=Performance, E=Alerts,
      F=Monthly Payments - Earned, G=Monthly Payments - Paid,
      H=Monthly Balance, I=Payment Status, J=Overall Balance, K=Verified.
    Only clean text statuses/alerts are kept (numeric/all-$$$ cells are
    template leftovers and are ignored by the tracker UI).
    """
    seeds = {}
    for r in range(1, ws.max_row + 1):
        mid = ws.cell(r, 1).value
        if not isinstance(mid, (int, float)) or isinstance(mid, bool):
            continue
        payment_status = _clean(ws.cell(r, 9).value)  # I
        alerts = _clean(ws.cell(r, 5).value)  # E
        verified = _clean(ws.cell(r, 11).value)  # K
        seed = {}
        if payment_status in _STATUS_SET:
            seed["paymentStatus"] = payment_status
        if alerts in _ALERT_SET:
            seed["alerts"] = alerts
        if verified in {"Yes", "No"}:
            seed["verified"] = verified
        seeds[int(mid)] = seed
    return seeds


# ════════════════════════════════════════════════════════════════════
# LIVE PERFORMANCE — CHAK DHIS2 (ereporting · MOH 731) for DARAJA
#
# Only milestones whose target is measurable from DHIS2 get real numbers
# (ids 6, 7, 8, 9, 10, 11, 14, 15, 16, 21).  Every other milestone keeps "—" until
# its record-based / EMR-based verification happens.
# ════════════════════════════════════════════════════════════════════

# -- CHAK DHIS2 sources, manager-confirmed 2026-09-10 ------------------
#
#  #6  HTS_TST / HTS_TST_POS   -> OFFICIAL indicators.  The old
#                                 hand-assembled 8-element list missed the
#                                 PMTCT and SNS entry points (MTRH Jul 2026:
#                                 349 vs the official 499).
#  #7  TX_NEW / HTS_TST_POS    -> "take the TX_NEW / hts pos * 100;
#                                 thats the formula".
#  #8  PrEP_New / 486          -> ONLY "PrEP_New: PrEP, New Clients".
#  #9  IIT / [TX_CURR(previous quarter close) + sum TX_NEW(this quarter)]
#  #10 DSD -> the seven *appropriate* DSD-model rows of the new
#                                 "TX_CURR Differentiated Care Model"
#                                 element (Standard Care, Fast Track,
#                                 Facility ART Group, Community ART Group,
#                                 Community ART Distribution Points,
#                                 Community Pharmacy, Individual ART
#                                 Distribution) ÷ TX_CURR.  The eighth row,
#                                 "No DSD", is the not-yet-enrolled
#                                 remainder and is EXCLUDED — including it
#                                 would pin the ratio at 100%.  Registry:
#                                 "Target: ≥90% of PLHIV enrolled in an
#                                 appropriate DSD model", scale
#                                 ≥90 / 70–89 / 50–69 / <50.
#  #11 AHD -> manager ruling ("AHD is calculated by (TX_NEW CD4 < 200 +
#                                 TX_NEW CD4 >=200) / TX_NEW").  The two
#                                 CD4 buckets are the MOH 731 CD4
#                                 disaggregation of TX_NEW: Starting ART.
#                                 Reads as: "of every client newly started
#                                 on ART, what share had their CD4
#                                 established" = the FAA proxy for
#                                 "% of adult PLHIV at risk of AHD
#                                 screened using CD4 cell count".
#                                 (CD4 "Unknown" is the not-screened
#                                 remainder and is deliberately excluded.)
#  #15 TB_PREV Numerator / TB_PREV Denominator   -> the official
#                                 "proportion of eligible PLHIV initiated
#                                 on TPT" indicator (WHO/NASCOP TB_PREV).
#                                 The old "TPT TX_Curr Total / TX_CURR"
#                                 proxy reported 6-9% where the real
#                                 coverage is 92-100%.
#  #16 VL suppressed / VL done
#  #14 TX_TB Denominator / TX_CURR -> "% of PLHIV screened for TB".
#                                 The TX_TB denominator (screened negative
#                                 + positive, already-on-ART + new-on-ART)
#                                 over TX_CURR.  Summed across the Jamii
#                                 Tekelezi and CHAP Stawisha TX_TB quartets
#                                 (verified disjoint).
#
# Retired: the MOH731_HV01-19 positive source (0 at the test sites), the
# 15 "PREP_ALLMod * New F/M" elements (0 at the test sites), the six
# legacy "... Linked within/outside" elements, and "C&T (facility) -
# Tx_ML, COD" (G9HTTIls3L6) — that element's category combo is COD =
# *Cause of Death*, not interruption in treatment.
_IND_HTS_TESTED = "MSdR6p2OEmx"     # HTS_TST     : Numerator (indicator)
_IND_HTS_POSITIVE = "smzxVpKXbR5"   # HTS_TST_POS : Numerator (indicator)
_DE_TX_NEW = "vTTEybkXZ53"          # TX_NEW: Starting ART   (#7, #9, #11)
_DE_TX_NEW_CD4_LT200 = "jbLj76PejpY"   # TX_NEW: Starting ART, CD4 <200  (#11)
_DE_TX_NEW_CD4_GE200 = "DiriHmlA9te"   # TX_NEW: Starting ART, CD4 >=200 (#11)
_DE_TX_CURR = "kgzd9LfXZXq"         # TX_CURR                   (#9, #15)
_DE_PREP_NEW = "VIg3ciXYUQn"        # PrEP_New: PrEP, New Clients   (#8)
_DE_TX_ML_OUTCOMES = "bv9nAL9x5Q5"  # C&T (facility) - Tx_ML, Outcomes
_DE_VL_DONE = "JGd3MwmKBuM"         # TX_PVLS (D) Routine — VL done
_DE_VL_SUPPRESSED = "FloZph8hN9z"   # TX_PVLS (N) Routine — VL suppressed
_DE_TPT = "dysZutXWPTz"             # TPT TX_Curr Total (indicator, unused)
_IND_TB_PREV_NUM = "D73JcPGIIIA"    # TB_PREV Numerator Total   (#15)
_IND_TB_PREV_DEN = "cJoXKb6p94M"    # TB_PREV Denominator Total (#15)

# -- TX_CURR disaggregation elements added to CHAK DHIS2 (Oct 2026) -----
# Three new AGGREGATE elements the CHAK instance grew for the PEPFAR MER
# return.  Each is a SINGLE element whose rows live in its category option
# combos (4 age×sex COCs per row), so they cannot be read with the flat
# `dx:` request the rest of this module uses — they come back from
# `_chak_analytics_coc_cells` instead (see `_fetch_coc_breakdowns`).
#
# Every id and COC below was read off the saved "PEPFAR: MER" data-entry
# form (train/ver2026.html: entry fields are
# `id="<dataElement>-<categoryOptionCombo>-val"` and the `title=` attribute
# carries the full element+COC name), then verified live against CHAK
# DHIS2 — the elements resolve by id (HTTP 200) with exactly the names and
# category combos noted below, and all 48 COCs resolve with the expected
# display names.
#
# ⏳ As of 2026-10-06 none of the three carries any returns yet (they
# were created 2026-10-05/06 and the site reports have not moved onto
# them), so #10/#11/#15 all fall back to their previous rules until CHAK
# starts populating them.  See the ⏳ FALLBACK notes at each metric.
_DE_TX_CURR_DSD = "n2O2iO3h4wl"         # TX_CURR Differentiated Care Model
_DE_TX_CURR_TPT_INIT = "Hvxl2zy6Ahi"    # TX_CURR TPT Initiation
_DE_TX_CURR_AHD_SCREEN = "AhdScreen01"  # TX_CURR AHD Screening (CD4/WHO)

# #10 DSD — category combo "DSD Model, Coarse Age ,sex": 8 model rows × 4
# age×sex COCs.  Only the seven *appropriate* models are counted; the
# eighth row, "No DSD", is the not-yet-enrolled remainder and is
# deliberately EXCLUDED.
_DSD_MODEL_COCS = [
    "BLW5dOBx1Lw", "F3p966XrGD4", "Z6SY5I59Gmf", "ohRoIsCs4DP",   # Standard Care
    "ssPAztCDDAy", "LuEuDGAtabW", "U7S9ySNgjRO", "hKeOVnYYXZc",   # Fast Track
    "g35O91AIELa", "YN1smch1maB", "uemoiOSOCLe", "tMtySWBwYeI",   # Facility ART Group
    "jzhzJduu7Ia", "WmqX75z2JVr", "hhgiEtJE1XO", "Xh8KNfQbWga",   # Community ART Group
    "vxkaCDTmJJD", "MC3hwmW1UKQ", "eKxL11RMhmR", "DLThbiLL7q6",   # Comm. ART Distr Points
    "mzcCaJ6szBr", "a1yKqfT1CHb", "obtJt7zaJXk", "fHbmFYhXCcf",   # Community Pharmacy
    "yzzVkh36avi", "cuzFvkzfBdB", "Mn7NpaVcgJZ", "xU765yRa1N7",   # Individual ART Distr
]
# "No DSD, <15F / 15+F / <15M / 15+M" — the EXCLUDED row, kept for the record
_NO_DSD_COCS = ["ablfhK3qO66", "JxKajLb6WIe", "CmlhtDJL9Pc", "Xx4xyFvPTP3"]

# #15 TPT — category combo "TPT Status, Coarse Age , Sex": 3 status rows × 4
# COCs.  The three rows are a TX_CURR disaggregation, so
# Started TPT + On TB Treatment + Not on TPT should equal TX_CURR.
_TPT_STARTED_COCS = ["ES323Pi0UJz", "WkJkHvKkgjZ", "EKXfCgMyu3N",
                     "RmRvJy5giTK"]                      # Started TPT
_TPT_ON_TB_RX_COCS = ["t38X02PeBJC", "rPbK3vxOmyf", "EVvXOgggQrw",
                      "Q3KA4eHjYxo"]                      # On TB Treatment
_TPT_NOT_ON_TPT_COCS = ["zeu0nIAO4aO", "DRjR6REBnlo", "qFCvRERXnPS",
                        "r57bPGgeBMr"]                    # Not on TPT

# #11 AHD — category combo "Coarse Age Bands, Gender": 1 row × 4 COCs.
# Deliberately the SAME category combo (and therefore the same four COC
# uids) as "TX_CURR SHA Registration" (zo2kCCIXoKv) — only the data
# element differs.
_AHD_SCREEN_COCS = ["OevHfyGgInv", "DWqTykR3F4M", "ZdCFqMGcaS0",
                    "BzePtc1mBUE"]

# #14 TB/HIV Case Identification — "% of PLHIV screened for TB".
# Numerator = the TX_TB *denominator* (every ART client screened for TB:
# negative + positive, already-on-ART + newly-on-ART) = the PBIX
# "TX_TB(Denominator)" arm.  Denominator = TX_CURR.
# Each namespace carries its own TX_TB denominator quartet:
#   Jamii Tekelezi (MER Indicator Reporting Tool / JTP Monthly HIV
#     Prevention and Testing / JTP Monthly HIV Care and Treatment):
#     TX_TB : Already on ART (TX_CURR) - Screened Negative / Positive
#     TX_TB : NEW on ART              - Screened Negative / Positive
#   CHAP Stawisha (Stawisha TB Reports, xGYwTcfvEH5):
#     TX_TB Denominator Negative Screen Already on ART / New on ART
#     TX_TB Denominator Positive Screen Already on ART / New on ART
# Verified live 202608: Jamii 36,777 + Stawisha 31,744 = 68,521 against
# TX_CURR 81,042 => 84.5%.  Disjointness proven: across the 259-facility
# roster 159 are Jamii-only and 62 Stawisha-only, 0 report into both,
# and each subset reproduces only its own arm (36,777 / 0 and 0 / 31,744).
# NOTE: deliberately NOT clamped to 100 — the FAA workbook warns this
# measure can exceed 100% when screened counts outrun the TX_CURR
# snapshot, so the raw percentage is shown as-is.
_DE_TX_TB_DEN_JTP = [
    "RhjKYAbimpZ",   # TX_TB : Already on ART (TX_CURR) - Screened Negative
    "Vgjf2ORAriB",   # TX_TB : Already on ART (TX_CURR) - Screened Positive
    "YuumdQIr0Pm",   # TX_TB : NEW on ART - Screened Negative
    "KAA3P0ab7op",   # TX_TB : NEW on ART - Screened Positive
]
_DE_TX_TB_DEN_62 = [
    "s5a2vLWGSai",   # TX_TB Denominator Negative Screen Already on ART
    "T5Tx34HORt4",   # TX_TB Denominator Negative Screen New on ART
    "WzklwQABYGE",   # TX_TB Denominator Positive Screen Already on ART
    "Z6j8WOPI3eL",   # TX_TB Denominator Positive Screen New on ART
]

# ══════════════════════════════════════════════════════════════════
# #21 Commodity Security — KHIS (NATIONAL) reporting rates
# ══════════════════════════════════════════════════════════════════
# 🔥 SOURCE IS KHIS, *NOT* CHAK DHIS2.
#   https://hiskenya.dha.go.ke/api   (DHIS2 2.40.9.1)
# The three Revision-2023 monthly commodity returns are national MOH forms;
# the CHAK ereporting instance does not carry them.  The July 2026 measurements
# below were taken straight off KHIS and reconcile with the independent
# `jt_reporting_rates/` app, which reads the same endpoint.
#
# "Reporting rate" here is measured from the DATA, not from KHIS's
# `completeDataSetRegistration` flag: a facility counts as having reported a
# form when it submitted at least ONE of the regimen rows that prove the form
# was filled in.  Requiring ALL of them would conflate *stocking* with
# *reporting* — a site that stocks no infant AZT/NVP regimen still correctly
# files MOH 729 with a zero (that is why "all three" collapses from ~195 to
# ~126 facilities on the ARV forms while the form was plainly filed).
#
# The denominator is the KHIS-ASSIGNED facility set
# (`dataSets/{id}/organisationUnits`), never the raw roster: only 212 of the
# 262 Daraja facilities are assigned MOH 729B/730B, so a roster denominator
# would penalise ~50 non-ART sites for not filing an ART return.
_KHIS_MOH_FORMS = [
    {
        "key": "moh643",
        "short": "MOH 643B",
        "title": "MOH 643 B - 2023 (FCDRR / laboratory)",
        "ds_id": "NQNojl5zVko",
        "detect": ["YOEPZvsPFPY", "NGzQCnV1mAG", "gSdD0f5RQuw"],
        "detect_label": "Rapid HIV 1+2 Test 1 / 2 / 3",
    },
    {
        "key": "moh730",
        "short": "MOH 730B",
        "title": "MOH 730 B - 2023 (CDRR / ARV & OI)",
        "ds_id": "UDZ4RKvvYRt",
        "detect": ["Sc9m3vXuCtU", "i63W5Q15kKC", "CALM061sapC"],
        "detect_label": ("ABC/3TC 600/300mg 30s · ABC/3TC/DTG 60/30/5mg 90s · "
                         "TAFLD 25/300/50mg 90s"),
    },
    {
        "key": "moh729",
        "short": "MOH 729",
        "title": "MOH 729 - 2023 (ART / F'MAPS)",
        "ds_id": "BD4tTSw9y64",
        "detect": ["pnJ2jrHU9Y3", "NeZ1cr1YTP0", "asTTgEPjTmu"],
        "detect_label": ("PC8 AZT liq + NVP liq · CF2G ABC+3TC+DTG · "
                         "PM12 PMTCT TAF+3TC+DTG"),
    },
]
# The KHIS Daraja roster (262 facilities, all national UIDs) — the same
# census the Daraja milestone is scored against.  Authored by the
# jt_reporting_rates app; read-only here.
# A copy of that roster ships INSIDE this app on purpose.  The sibling
# `jt_reporting_rates/` folder is a SEPARATE git repository with its own
# deployment, so it is NOT part of this repo's Render clone - reading only the
# sibling path silently yields an EMPTY roster in production, which zeroes
# milestone #21.  The sibling path is kept as a fallback for a dev checkout
# that does not have the in-app copy.
_KHIS_DARAJA_ROSTER_CANDIDATES = (
    BASE_DIR / "data" / "khis_daraja_roster.csv",
    BASE_DIR.parent / "jt_reporting_rates" / "data" / "daraja_filters.csv",
)
_KHIS_DARAJA_ROSTER = next(
    (p for p in _KHIS_DARAJA_ROSTER_CANDIDATES if p.exists()),
    _KHIS_DARAJA_ROSTER_CANDIDATES[0],
)

# CHAK org-unit name index (uid -> facility name), used as the fallback when an
# MFL code cannot be resolved from live metadata.  `CHAK_Visuals_4_explore/` is
# git-ignored (it is the PBIX exploration workspace), so a copy ships inside
# the app for the same reason as the roster above.
_CHAK_FACILITY_INDEX_CANDIDATES = (
    BASE_DIR / "data" / "all_chak_facilities.csv",
    BASE_DIR.parent / "CHAK_Visuals_4_explore" / "all_chak_facilities.csv",
)
_CHAK_FACILITY_INDEX = next(
    (p for p in _CHAK_FACILITY_INDEX_CANDIDATES if p.exists()),
    _CHAK_FACILITY_INDEX_CANDIDATES[0],
)
_KHIS_COMMODITY_CACHE = BASE_DIR / "data" / "_khis_commodity_rates.json"
_KHIS_COMMODITY_TTL = 6 * 3600   # KHIS is a national server — be gentle

# ── Jamii Tekelezi (previous project) ↔ CHAP Stawisha (62) twins ──
# The Daraja roster reports into two mutually-exclusive DHIS2 attribute
# option combos (funding mechanisms), so every metric below is the SUM of
# both namespaces — mirroring the PBIX COALESCE(a,0)+COALESCE(b,0) DAX.
# All ids verified live against CHAK DHIS2 (period 202608).
# NOTE: #15 TB_PREV and TPT TX_Curr are reported *only* by the Stawisha
# dataset — no Jamii twin exists in this DHIS2 build.
_DE_TX_NEW_62_CD4_LT200 = "Syg8KH15VW6"   # TX_New CD4<200         (#11)
_DE_TX_NEW_62_CD4_GE200 = "gxEX3f1Wi4i"   # TX_New CD4>200         (#11)
_DE_TX_NEW_62_CD4_UNK   = "r2X4WnVpKQG"   # TX_New CD4 unknown   (#7, #9)
_DE_TX_CURR_62 = "aMp82zBYPnx"            # TX_CURR Patients on Care (#9)
_DE_TX_IIT_62 = "DzgJFEbnElF"             # TX_IIT STA              (#9)
_DE_VL_62 = ["XfG4IcrxsAL", "ya8yqHMBz1z",    # VL <50 | 50-199
             "JkR9WcfccpF", "Ub1rdwX3AQK"]     # 200-399 | >1000 cps/ml
_DE_VL_62_SUPPRESSED = ["XfG4IcrxsAL", "ya8yqHMBz1z", "JkR9WcfccpF"]
_DE_PREP_NEW_62 = ["KFp4UYTJ4Q6", "S8VvgOzJRkX", "Nz7EhR18YMK",
                   "mSLKtkUIiXu", "ZVlWaa7hQyp", "EYOQtTc1Luo",
                   "KUfbLJCGou7"]
_HTS_TESTED_62 = [
    "FeL9n4JPBwR", "U5p3md08al7", "z4SijuAuj8u", "EBUHaKNgr76",
    "m0TGh0x0BKG", "eIgi7HI0dHC", "EbemQ1YUsS4", "geC2CBzyQme",
    "JEOphdexA5h", "oRcQ7WvMSbg", "GpUsEYocjeF", "n1gIS3iRf5b",
    "iWTSCEnAzth", "ZMvTVuvnujj", "sE6Fiu7oCWG", "dkX4EY6cwl9",
    "U60JE807fKl", "Zc6u4IbiDtI", "DR7CJrCb99O", "qfGXWJ4dyfq",
    "lU61bvd4vFS", "qrOHMHfq6vW", "fan1vuTrnfZ", "lm2vXVEzxgd",
    "WFBz2SqHikz", "F2vqHaV3SIV", "DDYp26Y2pLU", "j1Ovy0UzWKC",
]
_HTS_POSITIVE_62 = [
    "AqIZwh2gOUs", "FNCubo2RFGW", "Cwn1ZLCXt6B", "fryB6XsrdEX",
    "WgrVvWg6CEI", "xZvJ5UT2EK2", "BIQZfMkMzr6", "ObNBXpybAaC",
    "FX0DHPMp83V", "BhnzHXFnEM3", "iOfdKICx6r9", "b6RjSYPtLvy",
    "ztdFfMQWrSF", "S6KQd8Rmjad", "doYJQ4Ieqc7", "g3NOJTsqayy",
    "LdO5qX5j238", "SBGWvCJYoHl", "wrU23YQYX0l", "wuNiGmPCvjF",
    "MADCCrhi2wC", "jO8zNMIrakZ", "hzRWjr4PtME", "BpItig3EWij",
    "R9mc3S56hWD", "jbyp2irkHnt", "KhG8T1IxFNF", "HvXNwm2FiDE",
]
_TX_NEW_62_ALL = [_DE_TX_NEW_62_CD4_LT200, _DE_TX_NEW_62_CD4_GE200,
                  _DE_TX_NEW_62_CD4_UNK]

# #9 numerator = the three "Interruption in Treatment" outcome options of
# "C&T (facility) - Tx_ML, Outcomes".  Died / Transferred Out / Refused
# (Stopped) Treatment are NOT interruption.  This DHIS2 build ignores
# `co:<option-uid>` as a filter, so the element is pulled with the full
# category-option breakdown and rows are matched on the option NAME.
_IIT_OUTCOME_PREFIX = "Interruption"
_IIT_OUTCOME_COCS = ["aYhgkCY97Ga", "EDiSGvvIfoN", "l2jNAuxJvg9"]

_ALL_METRIC_DE_IDS = sorted({
    _IND_HTS_TESTED, _IND_HTS_POSITIVE, _DE_TX_NEW, _DE_TX_CURR,
    _DE_TX_NEW_CD4_LT200, _DE_TX_NEW_CD4_GE200,
    _DE_PREP_NEW, _DE_VL_DONE, _DE_VL_SUPPRESSED, _DE_TPT,
    _IND_TB_PREV_NUM, _IND_TB_PREV_DEN,
    # CHAP Stawisha (62) twins
    _DE_TX_NEW_62_CD4_LT200, _DE_TX_NEW_62_CD4_GE200, _DE_TX_NEW_62_CD4_UNK,
    _DE_TX_CURR_62, _DE_TX_IIT_62,
} | set(_DE_VL_62) | set(_DE_PREP_NEW_62)
  | set(_HTS_TESTED_62) | set(_HTS_POSITIVE_62)
  | set(_DE_TX_TB_DEN_JTP) | set(_DE_TX_TB_DEN_62))

_MONTH_ORD = {
    m: i for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep",
         "oct", "nov", "dec"]
    )
}

_MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

_DARJA_OUS_CACHE = None
_DARJA_OUS_CACHE_AT = 0.0
# A scope resolved *without* the live CHAK code lookup is name-matched only
# and may be missing facilities, so it is cached on a short TTL and retried
# once CHAK is reachable again — instead of being pinned for the process life.
_DARJA_SCOPE_LIVE_OK = False
_DARJA_SCOPE_DEGRADED_TTL = float(os.getenv("DARJA_SCOPE_DEGRADED_TTL", "300"))


def _daraja_scope():
    """Resolve the Daraja facility roster to CHAK DHIS2 org-unit ids.

    Reads train/Site_Census - Daraja.xlsx (the CHAK Daraja site census,
    259 facilities; supersedes the earlier Jamii Tekelezi + CHAP Stawisha
    scopes).  Each census row carries the
    national MFL code (col A) and the CHAK ereporting org units store the
    same code, so we match by MFL code first — this also catches the
    ~19 facilities whose CHAK display name differs from the census name
    (e.g. census 'Olkalou Sub-District Hospital' -> CHAK 'JM Kariuki
    Memorial County Referral Hospital').  Facilities with no code hit fall
    back to the local name index (all_chak_facilities.csv + CHAK MHUs.csv)
    with exact-first then containment matching.
    Returns (daraja_names, matched_ou_ids, matched_count).
    """
    global _DARJA_OUS_CACHE, _DARJA_OUS_CACHE_AT, _DARJA_SCOPE_LIVE_OK
    if _DARJA_OUS_CACHE is not None:
        if _DARJA_SCOPE_LIVE_OK or (
            time.time() - _DARJA_OUS_CACHE_AT <= _DARJA_SCOPE_DEGRADED_TTL
        ):
            return _DARJA_OUS_CACHE

    daraja_rows = []  # each: {"mfl": code, "name": census display name}
    census_path = BASE_DIR / "Site_Census - Daraja.xlsx"
    try:
        if census_path.exists():
            wb = openpyxl.load_workbook(
                census_path, data_only=True, read_only=True
            )
            if "Site_Census_Sep26" in wb.sheetnames:
                ws = wb["Site_Census_Sep26"]
                seen_mfl = set()
                for raw in ws.iter_rows(min_row=2, values_only=True):
                    if not raw:
                        continue
                    mfl = str(raw[0]).strip() if raw[0] is not None else ""
                    name = (
                        str(raw[5]).strip() if raw[5] is not None else ""
                    ).strip()
                    if not mfl or mfl in seen_mfl or not name:
                        continue
                    seen_mfl.add(mfl)
                    daraja_rows.append({"mfl": mfl, "name": name})
            wb.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] Daraja census parse failed: {exc}")
    daraja_names = [r["name"] for r in daraja_rows]

    # CHAK DHIS2 org-unit index (uid, lower-name) for name fallback
    index = []
    try:
        csv_path = _CHAK_FACILITY_INDEX
        if csv_path.exists():
            with open(csv_path, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    uid = (row.get("UID") or "").strip()
                    name = (row.get("Name") or "").strip().lower()
                    if uid and name:
                        index.append((uid, name))
        mhu_path = BASE_DIR.parent / "CHAK MHUs.csv"
        if mhu_path.exists():
            seen = {u for u, _ in index}
            with open(mhu_path, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    uid = (row.get("organisationunitid") or "").strip()
                    name = (
                        row.get("organisationunitname") or ""
                    ).strip().lower()
                    if uid and name and uid not in seen:
                        index.append((uid, name))
                        seen.add(uid)
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] CHAK OU index load failed: {exc}")

    by_name = {}
    for uid, name in index:
        by_name.setdefault(name, uid)
    flex = list(by_name.items())

    # Primary join: national MFL code -> CHAK org-unit uid (live metadata).
    by_code = _fetch_chak_ou_by_code(
        [r["mfl"] for r in daraja_rows]
    )
    live_ok = bool(by_code)

    matched_ids = []
    for row in daraja_rows:
        uid = by_code.get(row["mfl"])
        if not uid:
            key = row["name"].lower().strip()
            uid = by_name.get(key)
            if not uid:
                for fn, cand in flex:
                    if key in fn or fn in key:
                        uid = cand
                        break
        if uid:
            matched_ids.append(uid)
    # unique, order-preserving
    matched_ids = list(dict.fromkeys(matched_ids))
    _DARJA_OUS_CACHE = (daraja_names, matched_ids, len(matched_ids))
    _DARJA_OUS_CACHE_AT = time.time()
    _DARJA_SCOPE_LIVE_OK = live_ok
    if not live_ok:
        print(f"[MILESTONE] Daraja scope resolved WITHOUT the live CHAK code "
              f"lookup ({len(matched_ids)}/{len(daraja_names)} name-matched); "
              f"will retry in {_DARJA_SCOPE_DEGRADED_TTL:g}s")
    return _DARJA_OUS_CACHE


def _fetch_chak_ou_by_code(codes):
    """Map CHAK ereporting org-unit codes (national MFL codes) to UIDs.

    Queries /api/organisationUnits.json with a code:in:[...] filter in
    chunks (URL-length safety).  Returns {} if CHAK is unreachable — the
    caller then falls back to name matching only.
    """
    mapping = {}
    try:
        from requests.auth import HTTPBasicAuth

        from services.dhis2 import CHAK_PASS, CHAK_USER, chak_get

        auth = HTTPBasicAuth(CHAK_USER, CHAK_PASS)
        # Chunk below URL-length comfort.  A *connection* failure is NOT retried:
        # `chak_get` already walks every candidate transport, so an outer retry
        # could only re-pay a port that is provably dead.  The old shape was
        # 3 chunks x 3 attempts x timeout=90 = 810 s of worst case, which on its
        # own exceeded Render's worker timeout and got the worker SIGKILLed.
        # Now the first refused chunk costs one ~4 s connect attempt per base.
        for i in range(0, len(codes), 100):
            chunk = codes[i:i + 100]
            params = {
                "filter": "code:in:[" + ",".join(chunk) + "]",
                "fields": "id,code,level",
                "paging": "false",
            }
            try:
                resp = chak_get("/organisationUnits.json", params,
                                read_timeout=20, auth=auth)
            except Exception as exc:  # noqa: BLE001
                print(f"[MILESTONE] CHAK OU-by-code fetch failed: {exc}")
                return {}
            if not resp.ok:
                print(f"[MILESTONE] CHAK OU-by-code HTTP "
                      f"{resp.status_code} on chunk {i // 100}")
                return {}
            for ou in resp.json().get("organisationUnits", []) or []:
                c = (ou.get("code") or "").strip()
                if c and ou.get("level") == 5 and c not in mapping:
                    mapping[c] = ou["id"]
        return mapping
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] CHAK OU-by-code fetch failed: {exc}")
        return {}


def _pe_key(pe):
    """Sortable key for a DHIS2 period label ('202607', 'July 2026', …).

    Always returns (year, month) with month 1-12 so the same key can be
    used for sorting and for the calendar-quarter maths.
    """
    s = str(pe).strip()
    m = re.match(r"^(\d{4})(\d{2})$", s)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    m = re.match(r"^([A-Za-z]+)[\s\-_/]*(\d{4})$", s)
    if m:
        ord_ = _MONTH_ORD.get(m.group(1).lower()[:3])
        if ord_ is not None:
            return (int(m.group(2)), ord_ + 1)
    return (0, 0)


def _fetch_daraja_metrics_data(ou_ids):
    """Pull all MOH 731 DEs for the Daraja OU set (one analytics request).

    Returns {de_id: {period_label: value}} — {} if the server is
    unreachable or returned nothing (caller degrades gracefully).
    """
    try:
        from services.dhis2 import _chak_analytics_fetch

        return _chak_analytics_fetch(
            _ALL_METRIC_DE_IDS, list(ou_ids), "LAST_12_MONTHS"
        ) or {}
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] CHAK DHIS2 metrics fetch failed: {exc}")
        return {}


def _fetch_iit_numerator(ou_ids):
    """#9 numerator — the 'Interruption in Treatment' outcomes of Tx_ML.

    Returns {period_label: value} across the last 12 months so the tracker
    can pick the anchor month straight out of it.
    """
    try:
        from services.dhis2 import _chak_analytics_fetch_coc

        return _chak_analytics_fetch_coc(
            _DE_TX_ML_OUTCOMES, list(ou_ids), "LAST_12_MONTHS",
            name_prefixes=(_IIT_OUTCOME_PREFIX,),
        ) or {}
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] CHAK IIT (Tx_ML outcomes) fetch failed: {exc}")
        return {}


def _fetch_coc_breakdowns(ou_ids):
    """COC-level cells for the three new TX_CURR disaggregation elements.

    #10 DSD, #15 TPT and #11 AHD are all ROW totals live *inside* one data
    element, so they need the category-option breakdown rather than the
    flat `dx:` pull `_fetch_daraja_metrics_data` does.  All three elements
    are requested together: their category combos are distinct, so the 48
    COC uids cannot collide.

    Returns {period_name: {coc_uid: value}} across the last 12 months, so
    the tracker can read the anchor month straight out of it — {} on any
    failure (including "the instance has no values for these elements").
    """
    try:
        from services.dhis2 import _chak_analytics_coc_cells

        return _chak_analytics_coc_cells(
            [_DE_TX_CURR_DSD, _DE_TX_CURR_TPT_INIT, _DE_TX_CURR_AHD_SCREEN],
            list(ou_ids), "LAST_12_MONTHS",
        ) or {}
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] CHAK COC breakdown fetch failed: {exc}")
        return {}


def _khis_commodity_reporting(period):
    """#21 — Daraja reporting rates for the three national MOH commodity forms.

    Reads **KHIS** (hiskenya.dha.go.ke), *not* CHAK DHIS2 — these Revision-2023
    returns are national forms the CHAK instance does not carry.

    `period` is a DHIS2 month id ('202608').  Returns
        {"period":…, "forms": [{key, short, title, expected, reporters,
                                assigned, rate, detect_label}, …], "avg": float}
    or {} when KHIS is unreachable / the roster is unreadable.  Disk-cached
    for _KHIS_COMMODITY_TTL so a flapping national server cannot stall the
    milestone payload.
    """
    if not period:
        return {}

    try:
        if _KHIS_COMMODITY_CACHE.exists():
            cached = json.loads(
                _KHIS_COMMODITY_CACHE.read_text(encoding="utf-8"))
            if (cached.get("period") == period
                    and (time.time() - cached.get("ts", 0))
                    < _KHIS_COMMODITY_TTL):
                return cached.get("payload") or {}
    except Exception:  # noqa: BLE001
        pass

    try:
        import requests
        from requests.auth import HTTPBasicAuth

        from services.khis import KHIS_BASE, KHIS_PASS, KHIS_USER
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] KHIS import failed: {exc}")
        return {}

    fac_county = {}
    try:
        with open(_KHIS_DARAJA_ROSTER, encoding="utf-8-sig") as fh:
            for row in csv.DictReader(fh):
                fid = (row.get("facility_id") or "").strip()
                if fid:
                    fac_county[fid] = (row.get("county_id") or "").strip()
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] KHIS Daraja roster read failed: {exc}")
        return {}
    if not fac_county:
        return {}

    roster = set(fac_county)
    county_ids = sorted({c for c in fac_county.values() if c})
    auth = HTTPBasicAuth(KHIS_USER, KHIS_PASS)
    base = KHIS_BASE.rstrip("/")

    def _get(path, params, timeout=180, attempts=3):
        """GET with retries.  KHIS is a national server and occasionally
        returns a truncated/partial `dataValueSets` page under load, which
        would silently UNDER-count reporters — so never accept a partial
        read as final."""
        for i in range(attempts):
            try:
                resp = requests.get(f"{base}/{path}", params=params,
                                    auth=auth, timeout=timeout)
                if resp.status_code == 200:
                    return resp.json()
            except Exception:  # noqa: BLE001
                pass
            if i < attempts - 1:
                time.sleep(1.5 * (i + 1))
        return None

    forms = []
    for form in _KHIS_MOH_FORMS:
        # Facilities KHIS *expects* to file this dataset nationally.
        assigned = set()
        page = 1
        while True:
            d = _get(f"dataSets/{form['ds_id']}/organisationUnits.json",
                     {"fields": "id", "page": page, "pageSize": 2000})
            if not d:
                break
            ous = d.get("organisationUnits") or []
            assigned.update(o["id"] for o in ous if o.get("id"))
            total = (d.get("pager") or {}).get("total", len(assigned))
            if len(assigned) >= total or not ous:
                break
            page += 1
        if not assigned:
            print(f"[MILESTONE] KHIS {form['short']}: no assigned OUs — skipped")
            continue

        # Facilities that actually submitted one of the proving regimen rows.
        # A failed county read poisons the whole form (it can only lose
        # reporters), so abort the form rather than publish a low number.
        detect = set(form["detect"])
        reporters = set()
        failed = 0
        for cid in county_ids:
            d = _get("dataValueSets.json",
                     {"dataSet": form["ds_id"], "period": period,
                      "orgUnit": cid, "children": "true", "paging": "false"})
            if d is None:
                failed += 1
                continue
            for v in (d.get("dataValues") or []):
                if v.get("dataElement") in detect:
                    ou = v.get("orgUnit")
                    if ou:
                        reporters.add(ou)
        if failed or len(assigned) == 0:
            print(f"[MILESTONE] KHIS {form['short']}: {failed}/"
                  f"{len(county_ids)} county reads failed — form withheld")
            continue

        expected = len(assigned & roster)
        report_n = len(reporters & assigned & roster)
        forms.append({
            "key": form["key"],
            "short": form["short"],
            "title": form["title"],
            "expected": expected,
            "assigned": len(assigned),
            "reporters": report_n,
            "detect_label": form["detect_label"],
            "rate": round(100.0 * report_n / expected, 1) if expected else None,
        })

    rated = [f["rate"] for f in forms if f.get("rate") is not None]
    if len(rated) < 2:
        print("[MILESTONE] KHIS commodity rates: fewer than 2 forms resolved "
              "— #21 withheld for this build")
        return {}

    payload = {
        "period": period,
        "forms": forms,
        "avg": round(sum(rated) / len(rated), 1),
        "source": f"{KHIS_BASE} (KHIS national, Revision 2023)",
    }
    try:
        _KHIS_COMMODITY_CACHE.parent.mkdir(parents=True, exist_ok=True)
        _KHIS_COMMODITY_CACHE.write_text(
            json.dumps({"ts": time.time(), "period": period,
                        "payload": payload}, indent=2), encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
    print(f"[MILESTONE] KHIS commodity {period}: "
          + " ".join(f"{f['short']}={f['rate']}%" for f in forms)
          + f" avg={payload['avg']}%")
    return payload


def _period_sum(data, de_ids, period):
    total = 0.0
    for de in de_ids:
        total += float(data.get(de, {}).get(period, 0) or 0)
    return total


def _pe_lookup(data):
    """{(year, month): period_label} for every period present in `data`.

    Lets the metric maths address months by calendar position without
    guessing DHIS2's period-label format.
    """
    out = {}
    for de_map in (data or {}).values():
        for p in (de_map or {}):
            key = _pe_key(p)
            if key[0]:
                out.setdefault(key, p)
    return out


def _prev_quarter_close(year, month):
    """Last month of the calendar quarter BEFORE (year, month).

    Quarters follow the FAA schedule: Jan-Mar · Apr-Jun · Jul-Sep ·
    Oct-Dec.  So Aug -> Jun, Jul -> Jun, Jun -> Mar, Mar -> Dec.
    """
    q = (month - 1) // 3
    if q == 0:
        return year - 1, 12
    return year, [3, 6, 9][q - 1]


def _quarter_months_to(year, month):
    """The current quarter's months, from its 1st month through (year, month)."""
    start = ((month - 1) // 3) * 3 + 1
    return [(year, mm) for mm in range(start, month + 1)]


def _month_human(ym):
    """'September 2026' for a (year, month) tuple; '' when unusable."""
    try:
        year, month = int(ym[0]), int(ym[1])
    except (TypeError, ValueError, IndexError):
        return ""
    if not (1 <= month <= 12) or not year:
        return ""
    return f"{_MONTH_NAMES[month - 1]} {year}"


def _period_label_ym(label):
    """(year, month) from a schedule label.

    'Month 1: (September 1 - September 30, 2026)' -> (2026, 9).  Reading the
    calendar month straight off the workbook keeps each tab's CHAK baseline
    anchor tied to the sheet instead of a hard-coded date, so the tabs roll
    forward on their own when the workbook is refreshed.

    The match is anchored on real month NAMES rather than a loose
    "word + digits + year" pattern — the label opens with "Month 1:", and a
    loose pattern happily returns ('Month', 2026).
    """
    m = re.search(
        r"\b(January|February|March|April|May|June|July|August|September|"
        r"October|November|December)\s+\d{1,2}[^0-9]*(\d{4})",
        str(label or ""),
        re.IGNORECASE,
    )
    if not m:
        return None
    ord_ = _MONTH_ORD.get(m.group(1).lower()[:3])
    if ord_ is None:
        return None
    return (int(m.group(2)), ord_ + 1)


def _baseline_period_ym():
    """(year, month) pinned as the Baseline tab's anchor, or None.

    `_BASELINE_PERIOD` is a hand-edited setting, so it is parsed defensively:
    an unparseable value yields None (auto-follow) rather than crashing the
    build or silently pinning to January.  Returning None is also what makes
    the pin optional — `_compute_khis_metrics` treats it as a soft default.
    """
    if not _BASELINE_PERIOD:
        return None
    key = _pe_key(_BASELINE_PERIOD)
    return key if key and key[0] else None


def _periods_with_activity(data):
    """{(year, month): period_label} for months carrying any reported value.

    Zero-valued periods are excluded, so a month only becomes an anchor once
    a facility has actually submitted a return for it.
    """
    out = {}
    for de_map in (data or {}).values():
        for p, v in (de_map or {}).items():
            if not v:
                continue
            key = _pe_key(p)
            if key[0]:
                out.setdefault(key, p)
    return out


def _pick_anchor_period(data):
    """Latest month (chronological) with any reported activity.

    Prefers the most recent month where TX_CURR > 0 (ART stock is the most
    reliably reported value), falling back to any month with data.
    """
    if not data:
        return None
    tx_curr_de = data.get(_DE_TX_CURR, {})
    tx_curr_62_de = data.get(_DE_TX_CURR_62, {})
    periods = _periods_with_activity(data)
    if not periods:
        return None
    tx_periods = [
        label for (year, month), label in periods.items()
        if (float(tx_curr_de.get(label, 0) or 0)
            + float(tx_curr_62_de.get(label, 0) or 0)) > 0
    ]
    ordered = sorted(tx_periods or list(periods.values()), key=_pe_key)
    return ordered[-1] if ordered else None


def _unlock_bands(band, pct):
    """Apply the FAA 'Payment Scale per Achievement Threshold' for a metric.

    band: 'count' (id 6/8), 'linkage' (7), 'iit' (9), 'ahd' (11), 'tb' (14),
          'tpt' (15), 'dsd' (10), 'vl' (16), 'commodity' (21).  pct is the 0–100
          achievement measure.
    Returns (unlock_pct, band_label).
    """
    if band == "dsd":  # id 10 — registry: ≥90 / 70–89 / 50–69 / <50
        if pct >= 90:
            return 100, "\u226590% enrolled in a DSD model"
        if pct >= 70:
            return 80, "70\u201389% enrolled"
        if pct >= 50:
            return 50, "50\u201369% enrolled"
        return 0, "<50% enrolled \u2014 no payment"
    if band == "ahd":  # id 11 — FAA: ≥90 / 70–89 / 60–69 / <60
        if pct >= 90:
            return 100, "≥90% of at-risk PLHIV evaluated"
        if pct >= 70:
            return 80, "70–89% evaluated"
        if pct >= 60:
            return 50, "60–69% evaluated"
        return 0, "<60% evaluated — no payment"
    if band == "linkage":  # id 7
        if pct >= 95:
            return 100, "≥95% linked to ART"
        if pct >= 85:
            return 90, "85–94% linkage"
        if pct >= 75:
            return 80, "75–84% linkage"
        return 0, "<75% linkage — no payment"
    if band == "iit":  # id 9  (lower is better)
        if pct < 2.0:
            return 100, "IIT <2.0%"
        if pct < 3.0:
            return 80, "IIT 2.0%–<3.0%"
        if pct < 3.5:
            return 50, "IIT 3.0%–<3.5%"
        return 0, "IIT ≥3.5% — no payment"
    if band == "tpt":  # id 15
        if pct > 90:
            return 100, ">90% of monthly target"
        if pct >= 80:
            return 90, "80–90% of target"
        if pct >= 70:
            return 80, "70–79% of target"
        if pct >= 60:
            return 70, "60–69% of target"
        return 0, "<60% of target — no payment"
    if band == "tb":  # id 14 — FAA: >90 / 80-89 / 60-69 / below
        if pct > 90:
            return 100, ">90% of PLHIV screened for TB"
        if pct >= 80:
            return 80, "80-90% screened for TB"
        if pct >= 60:
            return 50, "60-79% screened for TB"
        return 0, "<60% screened for TB - no payment"
    if band == "vl":  # id 16
        if pct >= 95:
            return 100, "≥95% VL suppression"
        if pct >= 80:
            return 80, "80–94% suppression"
        if pct >= 60:
            return 50, "60–79% suppression"
        return 0, "<60% suppression — no payment"
    if band == "commodity":  # id 21 — FAA: >=90 / 80-89 / 70-79 / below
        if pct >= 90:
            return 100, "\u226590% of facilities reporting"
        if pct >= 80:
            return 80, "80\u201389% of facilities reporting"
        if pct >= 70:
            return 50, "70\u201379% of facilities reporting"
        return 0, "<70% of facilities reporting \u2014 no payment"
    if band == "reporting":  # id 22 — FAA: >=95 / 90-94 / 80-89 / below
        # Milestone 22's own scale, verbatim from the milestone registry:
        #   100% payment: ≥95% reporting
        #    80% payment: 90–94% reporting
        #    50% payment: 80–89% reporting
        #    No payment:  <80% reporting
        if pct >= 95:
            return 100, "\u226595% of HIV facilities reporting electronically"
        if pct >= 90:
            return 80, "90\u201394% reporting electronically"
        if pct >= 80:
            return 50, "80\u201389% reporting electronically"
        return 0, "<80% reporting electronically \u2014 no payment"
    # band == 'count' (ids 6 & 8) — achievement vs monthly count target
    if pct > 95:
        return 100, ">95% of monthly target"
    if pct >= 90:
        return 90, "90–95% of target"
    if pct >= 80:
        return 80, "80–89% of target"
    if pct >= 70:
        return 70, "70–79% of target"
    return 0, "<70% of target — no payment"


def _alert_for_unlock(unlock):
    """Read a milestone's Alerts chip off the payment scale it earned.

    The Alerts column uses the Summary2 tracker's own vocabulary, so only
    "On Track" / "Watch" / "Off Track" are renderable (`_ALERT_SET`).  The
    tracker seeds only exist for M1 ids 1–3, which left every
    DHIS2-measured milestone blank in that column even once its
    PERFORMANCE and EARNED cells filled in.

    A live baseline is a real measurement, so it can be banded honestly
    rather than left blank: a full unlock is On Track, a partial unlock is
    Watch, and no unlock is Off Track.  Returns None when there is no
    baseline, so milestones with no DHIS2 source still stay "—" instead of
    inventing a status.
    """
    if unlock is None:
        return None
    try:
        unlock = float(unlock)
    except (TypeError, ValueError):
        return None
    if unlock >= 100:
        return "On Track"
    if unlock > 0:
        return "Watch"
    return "Off Track"


def _metric_doc(metric_id, name, anchor, target, actual, pct, unlock,
                band, formula):
    return {
        "id": metric_id,
        "name": name,
        "asOf": anchor,
        "target": target,
        "actual": actual,
        "pct": round(pct, 1),
        "unlock": unlock,
        "band": band,
        "formula": formula,
    }


# ══════════════════════════════════════════════════════════════════════
# Milestone 22 — Digital Health Systems & Electronic Reporting Coverage
#
# Source: the NDWH's own UJTP DWAPI upload workbook (a per-facility
# submission log), NOT CHAK DHIS2.  See _dwapi_coverage().
# ══════════════════════════════════════════════════════════════════════

def _dwapi_latest_workbook():
    """Newest UJTP DWAPI upload workbook in train/, or None.

    Globbed rather than hard-coded because the file is re-issued monthly
    with a version suffix; newest mtime wins so the freshest snapshot is
    always the one scored.
    """
    try:
        found = sorted(
            BASE_DIR.glob(DWAPI_GLOB),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
    except OSError:
        return None
    return found[0] if found else None


def _dwapi_key(value):
    """Facility code as a bare string ('12234'); '' when blank.

    The roster and the upload log disagree on dtype — one side is text,
    the other arrives from Excel as a float ('12234.0') — so both are
    normalised through here before any set arithmetic.
    """
    if value is None:
        return ""
    if isinstance(value, float):
        if value != value:  # NaN
            return ""
        if value.is_integer():
            return str(int(value))
    text = str(value).strip()
    return "" if text in {"", "nan", "None", "NaT"} else text


def _dwapi_read(ws, required):
    """{header: [values]} for the first row whose header holds `required`.

    Locating the header by content (rather than assuming row 1) is what
    makes a re-exported sheet with a title banner above the table parse
    correctly.  Returns ({}, {}) when the sheet holds no such row.
    """
    rows = ws.iter_rows(values_only=True)
    for row in rows:
        header = [("" if c is None else str(c)).strip() for c in row]
        index = {}
        for i, name in enumerate(header):
            key = name.lower()
            if key and key not in index:
                index[key] = i
        if not set(required).issubset(index):
            continue
        table = {name: [] for name in index}
        for data in rows:
            for name, i in index.items():
                table[name].append(data[i] if i < len(data) else None)
        return index, table
    return {}, {}


def _dwapi_coverage():
    """Milestone 22's electronic-reporting coverage reading.

    The measure is deliberately the one the milestone text asks for — "of
    the HIV facilities, how many are reporting electronically":

        expected  = distinct MFLs on the `ndwh_` roster sheet (the care &
                    treatment and testing sites the programme answers for).
        reporting = those roster MFLs carrying an upload timestamp in the
                    workbook's newest submission month.
        pct       = reporting / expected × 100.

    A facility is counted once it has an `Updated` stamp *in that month*,
    because a row only exists in the log when an upload happened — the
    sheet is a submission log, not a roster with blanks.

    The month is the newest stamp present in the workbook, and milestone 22
    is MONTHLY, so the reading is scoped to it.  Two facts were verified
    against the live workbook before that filter was introduced
    (2026-10-02):

      * `Date`, `logDate` and `Updated` agree on the month for all 1116
        rows, so "the row's month" is unambiguous.
      * the stamps are a cumulative history (2021-07 … 2026-09) in which the
        newest month carries the bulk of the rows (741, against 27 in the
        month before it) — the newest stamp is the live submission window.

    The file is *named* "August 2026" while its stamps read September: it is
    the August reporting snapshot NDWH issued in September.  That is why the
    reading sits on the Baseline tab (pinned to August) while being filtered
    on the September stamp.

    Counted this way the headline is 204 of 211 (96.7%), which is identical
    to "facilities with a C&T or an HTS upload that month" — no facility
    submits only MNCH or PREP.  Sites that have never submitted at all, and
    sites that submitted in an earlier month but not this one, are both
    returned explicitly so the panel can name them.

    `status` is 'ok' only when the roster was readable, so a missing or
    renamed workbook degrades to no metric rather than a misleading zero.
    """
    out = {
        "status": "empty",
        "source": "National Data Warehouse (NDWH) — UJTP DWAPI upload log",
        "expected": 0,
        "reporting": 0,
        "pct": None,
        "note": "",
    }
    path = _dwapi_latest_workbook()
    if path is None:
        out["note"] = (
            "No UJTP DWAPI upload workbook was found in the app folder, so "
            "the electronic-reporting coverage reading is unavailable."
        )
        return out
    out["workbook"] = path.name
    try:
        wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
        try:
            names = list(wb.sheetnames)
            roster_sheet = _DWAPI_ROSTER_SHEET if _DWAPI_ROSTER_SHEET in names \
                else next(
                    (n for n in names
                     if _dwapi_read(wb[n], ("mfl",))[0]),
                    None,
                )
            if roster_sheet is None:
                out["note"] = (
                    f"No roster sheet with an 'mfl' column was found in "
                    f"{path.name}, so the expected-facility list could not "
                    "be read."
                )
                return out
            _ridx, roster_tbl = _dwapi_read(wb[roster_sheet], ("mfl",))

            log_sheet = _DWAPI_DATA_SHEET if _DWAPI_DATA_SHEET in names and \
                _dwapi_read(wb[_DWAPI_DATA_SHEET], ("code", "updated"))[0] \
                else next(
                    (n for n in names
                     if n != roster_sheet
                     and _dwapi_read(wb[n], ("code", "updated"))[0]),
                    None,
                )
            if log_sheet is None:
                out["note"] = (
                    f"No upload log with 'Code' and 'Updated' columns was "
                    f"found in {path.name}, so nothing could be scored."
                )
                return out
            _lidx, log_tbl = _dwapi_read(wb[log_sheet], ("code", "updated"))
        finally:
            wb.close()

        # ── the expected roster ──
        names_by_key, county_by_key = {}, {}
        for mfl, name, county in zip(
            roster_tbl.get("mfl", []),
            roster_tbl.get("name", [None] * len(roster_tbl.get("mfl", []))),
            roster_tbl.get("county", [None] * len(roster_tbl.get("mfl", []))),
        ):
            key = _dwapi_key(mfl)
            if not key or key in names_by_key:
                continue
            names_by_key[key] = str(name or "").strip()
            county_by_key[key] = str(county or "").strip()
        roster = set(names_by_key)

        # ── the upload log ──
        # 'Updated' / 'logDate' arrive as ISO-8601 strings
        # ('2026-09-14T21:18:17.000Z') and 'Date' as a bare 'YYYY-MM', so the
        # month is read off the text rather than through _iso(), which only
        # understands real date/datetime objects.
        submitted, by_docket, months, ever, rows = set(), {}, set(), set(), []
        codes = log_tbl.get("code", [])
        stamps = log_tbl.get("updated", [])
        dockets = log_tbl.get("docket", [None] * len(codes))
        dates = log_tbl.get("date", [None] * len(codes))
        for code, stamp, docket, stamp_date in zip(codes, stamps, dockets,
                                                   dates):
            key = _dwapi_key(code)
            if not key:
                continue
            if stamp is None or str(stamp).strip() == "":
                continue
            ever.add(key)
            month = ""
            for candidate in (_iso(stamp), stamp, _iso(stamp_date), stamp_date):
                text = str(candidate or "").strip()
                if len(text) >= 7 and text[4] == "-" and text[:4].isdigit() \
                        and text[5:7].isdigit():
                    month = text[:7]
                    break
            label = str(docket or "").strip().upper()
            if label in {"C&T", "CT"}:
                label = "C&T"
            if month:
                months.add(month)
            rows.append((key, month, label))

        # The milestone is MONTHLY, so the reading is scoped to the newest
        # submission month in the workbook (the docstring records why that
        # stamp is a sound calendar anchor when the file name is not).
        latest = max(months) if months else ""
        for key, month, label in rows:
            if month != latest:
                continue
            submitted.add(key)
            if label:
                by_docket.setdefault(label, set()).add(key)

        if not roster:
            out["note"] = (
                f"The roster sheet in {path.name} listed no facility codes."
            )
            return out

        reporting = sorted(roster & submitted)
        never = sorted(roster - ever)                  # never submitted
        lapsed = sorted((roster & ever) - submitted)   # earlier months only
        pct = len(reporting) / len(roster) * 100.0
        unlock, band = _unlock_bands("reporting", pct)

        # Per-docket coverage (distinct roster facilities, not rows) — the
        # supporting detail behind the headline facility count.
        per_docket = []
        for label in sorted(by_docket,
                            key=lambda d: -len(by_docket[d] & roster)):
            hit = len(by_docket[label] & roster)
            if not hit:
                continue
            per_docket.append({
                "docket": label,
                "reporting": hit,
                "expected": len(roster),
                "pct": round(hit / len(roster) * 100.0, 1),
            })

        # 'YYYY-MM' -> 'YYYYMM' so the shared period helpers can read it.
        latest_ym = _pe_key(latest.replace("-", "")) if latest else (0, 0)
        out.update({
            "status": "ok",
            "expected": len(roster),
            "reporting": len(reporting),
            "pct": round(pct, 1),
            "unlock": unlock,
            "band": band,
            "actual": f"{len(reporting)} of {len(roster)} facilities",
            "neverCount": len(never),
            "never": [
                {
                    "mfl": k,
                    "name": names_by_key.get(k, ""),
                    "county": county_by_key.get(k, ""),
                }
                for k in never[:25]
            ],
            "lapsedCount": len(lapsed),
            "lapsed": [
                {
                    "mfl": k,
                    "name": names_by_key.get(k, ""),
                    "county": county_by_key.get(k, ""),
                }
                for k in lapsed[:25]
            ],
            "dockets": per_docket,
            "logRows": len(codes),
            "monthRows": sum(1 for _k, _m, _d in rows if _m == latest),
            "everReporting": len(roster & ever),
            "latestMonth": latest,
            "latestMonthHuman": _month_human(latest_ym),
            "formula": (
                "Facilities carrying an upload timestamp in the workbook's "
                "newest submission month ÷ facilities on the NDWH "
                "expected-facility roster × 100 "
                f"({len(reporting)} of {len(roster)}). Source: "
                f"{path.name}, sheet '{roster_sheet}' for the roster and "
                f"'{log_sheet}' for the upload log. The month is "
                f"{_month_human(latest_ym)}, the newest stamp in the log."
            ),
            "note": (
                f"{len(reporting)} of {len(roster)} expected HIV facilities "
                f"submitted an upload in {_month_human(latest_ym)} "
                f"({pct:.1f}%). "
                + (f"{len(never)} have never submitted any docket. "
                   if never else "")
                + (f"A further {len(lapsed)} submitted in an earlier month "
                   "but not this one. "
                   if lapsed else "")
                + (
                    f"The workbook's stamps read "
                    f"{_month_human(latest_ym)} because it is the "
                    "August reporting snapshot NDWH issued in September, "
                    "so it is scored against the Baseline tab rather than "
                    "M1."
                    if latest else ""
                )
            ),
        })
        return out
    except Exception as exc:  # noqa: BLE001
        out["status"] = "error"
        out["note"] = f"Could not read {path.name}: {exc}"
        return out


def _compute_daraja_metrics(data, anchor, iit_by_period=None, commodity=None,
                            coc_by_period=None):
    """Compute the DHIS2-measurable milestones for the anchor month.

    `iit_by_period` is the #9 numerator series ({period_label: value} of
    the "Interruption in Treatment" outcomes) supplied by
    `_fetch_iit_numerator`; it is a separate call because it needs the
    category-option breakdown.

    `coc_by_period` is the same shape but keyed by category option COMBO
    ({period_label: {coc_uid: value}}) for the three new TX_CURR
    disaggregation elements, supplied by `_fetch_coc_breakdowns`.  #10 DSD,
    #11 AHD and #15 TPT are row totals INSIDE a single element, so they
    cannot be read from `data` (a flat `dx:` pull) — they need this second,
    category-option-broken read.

    `commodity` is the #21 KHIS commodity-reporting payload supplied by
    `_khis_commodity_reporting` — the one metric here that is NOT sourced
    from CHAK DHIS2.
    """
    if not data or not anchor:
        return [], None

    periods = _pe_lookup(data)

    def val(de_id, year, month):
        label = periods.get((year, month))
        if not label:
            return 0.0
        return float(data.get(de_id, {}).get(label, 0) or 0)

    def vsum(de_ids, year, month):
        """Sum a group of twin elements for one calendar month."""
        return sum(val(d, year, month) for d in de_ids)

    year, month = _pe_key(anchor)
    q_year, q_month = _prev_quarter_close(year, month)

    # Every measure is Jamii Tekelezi + CHAP Stawisha (the two AOCs never
    # overlap, so summing both namespaces gives the true Daraja total).
    tested = val(_IND_HTS_TESTED, year, month) \
        + vsum(_HTS_TESTED_62, year, month)
    positive = val(_IND_HTS_POSITIVE, year, month) \
        + vsum(_HTS_POSITIVE_62, year, month)
    tx_new = val(_DE_TX_NEW, year, month) + vsum(_TX_NEW_62_ALL, year, month)
    tx_curr = val(_DE_TX_CURR, year, month) + val(_DE_TX_CURR_62, year, month)
    prep_new = val(_DE_PREP_NEW, year, month) + vsum(_DE_PREP_NEW_62, year, month)
    vl_done = val(_DE_VL_DONE, year, month) + vsum(_DE_VL_62, year, month)
    vl_supp = val(_DE_VL_SUPPRESSED, year, month) \
        + vsum(_DE_VL_62_SUPPRESSED, year, month)
    tpt = val(_DE_TPT, year, month)
    tb_prev_num = val(_IND_TB_PREV_NUM, year, month)
    tb_prev_den = val(_IND_TB_PREV_DEN, year, month)
    # #14 numerator: the TX_TB *denominator* of both namespaces - every ART
    # client screened for TB.  The arms are disjoint (see _DE_TX_TB_DEN_JTP).
    tx_tb_den = vsum(_DE_TX_TB_DEN_JTP, year, month) \
        + vsum(_DE_TX_TB_DEN_62, year, month)
    # #9 numerator: Jamii "Tx_ML, Outcomes → Interruption" options + the
    # CHAP Stawisha "TX_IIT STA" element.
    iit_raw = float((iit_by_period or {}).get(anchor, 0) or 0) \
        + val(_DE_TX_IIT_62, year, month)

    # New TX_CURR disaggregation elements (#10 DSD, #11 AHD, #15 TPT).
    # `_chak_analytics_coc_cells` already sums across the whole OU roster,
    # so each `csum` below is the Daraja-wide ROW TOTAL for the anchor
    # month.  Empty when CHAK has no returns for the element yet.
    coc_cells = (coc_by_period or {}).get(anchor, {}) or {}

    def csum(coc_ids):
        return sum(float(coc_cells.get(c, 0) or 0) for c in coc_ids)

    dsd_enrolled = csum(_DSD_MODEL_COCS)
    ahd_screened = csum(_AHD_SCREEN_COCS)
    tpt_started = csum(_TPT_STARTED_COCS)
    tpt_on_tb_rx = csum(_TPT_ON_TB_RX_COCS)

    # #9 denominator: TX_CURR at the close of the PREVIOUS quarter, plus
    # every TX_NEW recorded so far in the CURRENT quarter.
    #
    # 🔥 The PBIX `%IIT` baseline is the SINGLE element `TX_CURR` — its DAX is
    #   Baseline_TX_CURR = CALCULATE(SUM(Value),
    #       'Data Elements'[Data Element] = "TX_CURR", Period = TX_CURR_Period)
    # (and `TX_CURR_Previous_Quarter`, line 1466, is the same single element).
    # Only the headline KPI / `TX_CURR_Monthly_Trend` uses all 9 TX_CURR-family
    # elements.  Adding the CHAP Stawisha roll-up (_DE_TX_CURR_62) here inflated
    # the denominator ~2.01x and halved `%IIT` versus the report.
    tx_curr_prevq = val(_DE_TX_CURR, q_year, q_month)
    tx_new_qtr = sum(
        val(_DE_TX_NEW, y, m) + vsum(_TX_NEW_62_ALL, y, m)
        for y, m in _quarter_months_to(year, month)
    )
    iit_denom = tx_curr_prevq + tx_new_qtr

    def fmt(v):
        return f"{round(v):,}" if abs(v) >= 10 else f"{v:,.0f}"

    metrics = []

    # ── #6 HIV Case Identification — monthly tests & positives ──
    #   Monthly testing target 21,584 · identification target 306
    #   Achievement = min(tests/21584, positives/306)  (FAA workbook).
    if tested or positive:
        pct6 = min(100.0, min(tested / 21584.0, positive / 306.0) * 100.0)
        unlock, band = _unlock_bands("count", pct6)
        metrics.append(_metric_doc(
            6, "HIV Case Identification", anchor,
            "21,584 tested · 306 positive / month",
            f"{fmt(tested)} tested · {fmt(positive)} positive",
            pct6, unlock, band,
            "min(people tested ÷ 21,584, positives ÷ 306) × 100 — CHAK DHIS2 "
            "HTS_TST / HTS_TST_POS : Numerator (Jamii Tekelezi) unioned with "
            "the CHAP Stawisha HTS testing / new-positive elements",
        ))

    # ── #7 Linkage of HIV-positive clients to ART ──
    #   Manager ruling: TX_NEW ÷ HTS_TST_POS × 100.  Target ≥95%.
    if positive:
        pct7 = min(100.0, tx_new / positive * 100.0)
        unlock, band = _unlock_bands("linkage", pct7)
        metrics.append(_metric_doc(
            7, "Linkage of HIV Positive Clients to ART", anchor,
            "≥95% of newly diagnosed linked to ART",
            f"{pct7:.1f}% · {fmt(tx_new)} started on ART of {fmt(positive)} "
            "positive",
            pct7, unlock, band,
            "TX_NEW ÷ HTS_TST_POS × 100 — CHAK DHIS2 "
            "(TX_NEW: Starting ART [Jamii] + TX_New CD4<200/>200/unknown "
            "[Stawisha] ÷ HTS_TST_POS : Numerator)",
        ))

    # ── #8 PrEP Initiation — monthly target 486 ──
    #   Manager ruling: only "PrEP_New: PrEP, New Clients" counts.
    if prep_new:
        pct8 = min(100.0, prep_new / 486.0 * 100.0)
        unlock, band = _unlock_bands("count", pct8)
        metrics.append(_metric_doc(
            8, "PrEP Initiation", anchor,
            "486 PrEP initiations / month (2,918 / 6)",
            f"{fmt(prep_new)} PrEP initiations",
            pct8, unlock, band,
            "(PrEP_New: PrEP, New Clients [Jamii] + the CHAP Stawisha PrEP "
            "new-client population elements) ÷ 486 (FAA monthly target) × "
            "100 — CHAK DHIS2",
        ))

    # ── #9 HIV Care, Treatment Continuity & Retention (IIT) ──
    #   Target: monthly IIT < 2.0% of patients on ART.
    #   Numerator = Tx_ML, Outcomes → only the "Interruption in Treatment"
    #     options (<3 months · 3–5 months · 6+ months).
    #   Denominator = TX_CURR (close of the previous quarter)
    #               + Σ TX_NEW (current quarter, 1st month → anchor month).
    #   Quarters: Jan–Mar · Apr–Jun · Jul–Sep · Oct–Dec.
    if iit_denom:
        iit_pct = iit_raw / iit_denom * 100.0
        unlock, band = _unlock_bands("iit", iit_pct)
        metrics.append(_metric_doc(
            9, "HIV Care, Treatment Continuity & Retention", anchor,
            "Monthly IIT < 2.0% of patients on ART",
            f"{iit_pct:.2f}% · {fmt(iit_raw)} interrupted of {fmt(iit_denom)} "
            f"on ART (TX_CURR {fmt(tx_curr_prevq)} + TX_NEW {fmt(tx_new_qtr)})",
            iit_pct, unlock, band,
            "(Tx_ML Outcomes → Interruption [Jamii] + TX_IIT STA [Stawisha]) "
            "÷ [TX_CURR(previous quarter close) + TX_NEW(current quarter to "
            "date)] × 100 — CHAK DHIS2",
        ))

    # ── #10 Differentiated Service Delivery (DSD) enrolment ──
    #   Registry: "Target: ≥90% of PLHIV enrolled in an appropriate DSD
    #   model"; scale ≥90 / 70–89 / 50–69 / <50.
    #   Numerator = the seven *appropriate* model rows of the new "TX_CURR
    #   Differentiated Care Model" element — Standard Care, Fast Track,
    #   Facility ART Group, Community ART Group, Community ART Distribution
    #   Points, Community Pharmacy, Individual ART Distribution.  The eighth
    #   row, "No DSD", is the not-yet-enrolled remainder and is EXCLUDED
    #   (including it would pin the ratio at 100%).  Denominator = TX_CURR.
    #   ⏳ The element was created 2026-10-05 and carries no returns yet, so
    #   this metric simply stays absent (rendered as "—") until CHAK starts
    #   reporting into it — there is no legacy rule to fall back on.
    if tx_curr and dsd_enrolled:
        dsd_pct = min(100.0, dsd_enrolled / tx_curr * 100.0)
        unlock, band = _unlock_bands("dsd", dsd_pct)
        metrics.append(_metric_doc(
            10, "Differentiated Service Delivery (DSD) Enrollment and "
                "Referral",
            anchor,
            "\u226590% of PLHIV enrolled in an appropriate DSD model",
            f"{dsd_pct:.1f}% \u00b7 {fmt(dsd_enrolled)} of {fmt(tx_curr)} "
            "on ART enrolled in a DSD model",
            dsd_pct, unlock, band,
            "(\u03a3 Standard Care + Fast Track + Facility ART Group + "
            "Community ART Group + Community ART Distribution Points + "
            "Community Pharmacy + Individual ART Distribution) \u00f7 "
            "TX_CURR \u00d7 100 \u2014 CHAK DHIS2 \"TX_CURR Differentiated "
            "Care Model\" (n2O2iO3h4wl), DSD Model, Coarse Age ,sex, "
            "\"No DSD\" row excluded",
        ))

    # ── #11 Advanced HIV Disease (AHD) identification & evaluation ──
    #   Manager ruling (2026-10): AHD = "total AHD / TX_CURR" — the new
    #   "TX_CURR Advanced HIV Disease (AHD) Screening (CD4/WHO)" element
    #   ("AhdScreen01") over TX_CURR.  Target ≥90% (FAA row 13:
    #   "Proportion of adult PLHIV at risk of AHD who are screened for AHD
    #   using CD4 cell count or WHO staging criteria").
    #   ⏳ FALLBACK: that element was created 2026-10-05 and carries no
    #   returns yet, so until CHAK reports into it the previous rule is
    #   used — (TX_NEW CD4 <200 + TX_NEW CD4 >=200) ÷ TX_NEW, i.e. of every
    #   client newly started on ART, the share whose CD4 was established.
    #   The `formula` string always names the rule actually applied.
    if tx_curr and ahd_screened:
        ahd_pct = min(100.0, ahd_screened / tx_curr * 100.0)
        ahd_detail = (f"{ahd_pct:.1f}% \u00b7 {fmt(ahd_screened)} screened "
                      f"for AHD of {fmt(tx_curr)} on ART")
        ahd_formula = (
            "TX_CURR Advanced HIV Disease (AHD) Screening (CD4/WHO) \u00f7 "
            "TX_CURR \u00d7 100 \u2014 CHAK DHIS2 \"AhdScreen01\" "
            "(Coarse Age Bands, Gender)"
        )
    elif tx_new:
        cd4_lt200 = val(_DE_TX_NEW_CD4_LT200, year, month) \
            + val(_DE_TX_NEW_62_CD4_LT200, year, month)
        cd4_ge200 = val(_DE_TX_NEW_CD4_GE200, year, month) \
            + val(_DE_TX_NEW_62_CD4_GE200, year, month)
        cd4_known = cd4_lt200 + cd4_ge200
        ahd_pct = min(100.0, cd4_known / tx_new * 100.0)
        ahd_detail = (
            f"{ahd_pct:.1f}% \u00b7 {fmt(cd4_known)} of {fmt(tx_new)} new "
            f"ART clients with CD4 established (<200 {fmt(cd4_lt200)} \u00b7 "
            f"\u2265200 {fmt(cd4_ge200)})"
        )
        ahd_formula = (
            "(TX_NEW CD4 <200 + CD4 >=200) \u00f7 TX_NEW \u00d7 100 \u2014 "
            "MOH 731 CD4 disaggregation, Jamii Tekelezi + CHAP Stawisha, "
            "CHAK DHIS2.  (Legacy rule \u2014 the new TX_CURR AHD Screening "
            "element has no returns yet.)"
        )
    else:
        ahd_pct = None

    if ahd_pct is not None:
        unlock, band = _unlock_bands("ahd", ahd_pct)
        metrics.append(_metric_doc(
            11, "Advanced HIV Disease (AHD) identification and evaluation",
            anchor,
            "\u226590% of adult PLHIV at risk of AHD identified & evaluated",
            ahd_detail,
            ahd_pct, unlock, band, ahd_formula,
        ))

    # ── #15 TB Preventive Therapy — 90% of eligible initiated ──
    #   Manager ruling (2026-10): read it out of the new "TX_CURR TPT
    #   Initiation" table, whose three status rows are a TX_CURR
    #   disaggregation (Started TPT / On TB Treatment / Not on TPT):
    #
    #       Started TPT ÷ (TX_CURR − On TB Treatment) × 100
    #
    #   Only the "Started TPT" row counts as initiated, and clients already
    #   on TB treatment are not TPT-eligible — so the denominator is TX_CURR
    #   less the "On TB Treatment" row (equivalently: Started TPT + Not on
    #   TPT, since the three rows should sum to TX_CURR).
    #   ⏳ FALLBACK: while the new element has no returns, the previous
    #   official CHAK DHIS2 indicator pair "TB_PREV Numerator Total" /
    #   "TB_PREV Denominator Total" (the WHO/NASCOP TPT coverage measure,
    #   reported by the CHAP Stawisha dataset) is used instead.  The
    #   `formula` string always names the rule actually applied.
    if tx_curr and tx_tb_den:
        tb_case_pct = tx_tb_den / tx_curr * 100.0
        unlock, band = _unlock_bands("tb", tb_case_pct)
        metrics.append(_metric_doc(
            14, "TB/HIV Case Identification", anchor,
            "\u226590% of PLHIV screened for TB",
            f"{tb_case_pct:.1f}% \u00b7 {fmt(tx_tb_den)} screened for TB of "
            f"{fmt(tx_curr)} on ART",
            tb_case_pct, unlock, band,
            "TX_TB(Denominator) \u00f7 TX_CURR \u00d7 100 - CHAK DHIS2 "
            "(TX_TB: Already on ART / NEW on ART - Screened Negative and "
            "Positive [Jamii Tekelezi] + TX_TB Denominator Negative and "
            "Positive Screen Already on / New on ART [CHAP Stawisha]) "
            "\u00f7 (TX_CURR [Jamii] + TX_CURR Patients on Care "
            "[CHAP Stawisha])",
        ))

    if tpt_started and (tx_curr - tpt_on_tb_rx) > 0:
        tpt_eligible = tx_curr - tpt_on_tb_rx
        tpt_pct = min(100.0, tpt_started / tpt_eligible * 100.0)
        tpt_detail = (
            f"{tpt_pct:.1f}% \u00b7 {fmt(tpt_started)} started TPT of "
            f"{fmt(tpt_eligible)} eligible (TX_CURR {fmt(tx_curr)} \u2212 "
            f"on TB treatment {fmt(tpt_on_tb_rx)})"
        )
        tpt_formula = (
            "Started TPT \u00f7 (TX_CURR \u2212 On TB Treatment) \u00d7 100 "
            "\u2014 CHAK DHIS2 \"TX_CURR TPT Initiation\" (Hvxl2zy6Ahi), "
            "TPT Status, Coarse Age , Sex \u2014 \"Started TPT\" and "
            "\"On TB Treatment\" rows"
        )
    elif tb_prev_den:
        tpt_pct = tb_prev_num / tb_prev_den * 100.0
        tpt_detail = (f"{tpt_pct:.1f}% \u00b7 {fmt(tb_prev_num)} of "
                      f"{fmt(tb_prev_den)} eligible initiated")
        tpt_formula = (
            "TB_PREV Numerator Total \u00f7 TB_PREV Denominator Total "
            "\u00d7 100 (CHAK DHIS2 indicator \u2014 reported by the CHAP "
            "Stawisha dataset).  (Legacy rule \u2014 the new TX_CURR TPT "
            "Initiation element has no returns yet.)"
        )
    else:
        tpt_pct = None

    if tpt_pct is not None:
        unlock, band = _unlock_bands("tpt", tpt_pct)
        metrics.append(_metric_doc(
            15, "TB Preventive Therapy", anchor,
            "90% of eligible PLHIV initiated on TPT",
            tpt_detail,
            tpt_pct, unlock, band, tpt_formula,
        ))

    # ── #16 Viral Load Suppression — ≥95% with documented VL ──
    if vl_done:
        vl_pct = vl_supp / vl_done * 100.0
        unlock, band = _unlock_bands("vl", vl_pct)
        metrics.append(_metric_doc(
            16, "Viral Load Suppression", anchor,
            "≥95% suppression among PLHIV with documented VL",
            f"{vl_pct:.1f}% · {fmt(vl_supp)} of {fmt(vl_done)} suppressed",
            vl_pct, unlock, band,
            "(TX_PVLS (N) ÷ TX_PVLS (D) Routine [Jamii] + VL results "
            "<1000 cps/ml ÷ all VL results [Stawisha]) × 100 — MOH 731",
        ))

    # ── #21 Commodity Security — monthly commodity-report submission ──
    #   Threshold: "≥90% of health facilities submitting monthly commodity
    #   reports".  Bands ≥90 / 80–89 / 70–79 / <70.
    #   🔥 KHIS (national), NOT CHAK DHIS2 — see _KHIS_MOH_FORMS.
    #   The milestone value is the MEAN of the three per-form reporting
    #   rates, each scored on the facilities KHIS assigns that form.
    if commodity and commodity.get("forms"):
        _cf = [f for f in commodity["forms"] if f.get("rate") is not None]
        if _cf:
            commodity_pct = sum(f["rate"] for f in _cf) / len(_cf)
            unlock, band = _unlock_bands("commodity", commodity_pct)
            _detail = " · ".join(
                f"{f['short']} {f['rate']:.1f}% ({fmt(f['reporters'])}/"
                f"{fmt(f['expected'])})" for f in _cf
            )
            metrics.append(_metric_doc(
                21, "Commodity Security", anchor,
                "≥90% of health facilities submitting monthly commodity "
                "reports",
                f"{commodity_pct:.1f}% · {_detail}",
                commodity_pct, unlock, band,
                "mean of the three MOH Revision-2023 commodity-report "
                "reporting rates × 100 — each rate = facilities submitting "
                "≥1 proving regimen ÷ facilities KHIS assigns that dataset, "
                "over the " + str(commodity.get("period") or "") + " month. "
                "Source: KHIS national (hiskenya.dha.go.ke), NOT CHAK "
                "DHIS2. MOH 643B detected on Rapid HIV 1+2 Test 1/2/3; "
                "MOH 730B on ABC/3TC 600/300 30s, ABC/3TC/DTG 60/30/5 90s, "
                "TAFLD 25/300/50 90s; MOH 729 on PC8, CF2G, PM12",
            ))

    return metrics, anchor


def _compute_khis_metrics(target_period=None, default_period=None):
    """Resolve Daraja → CHAK DHIS2, fetch MOH 731, score the milestones.

    `target_period` HARD-pins the scores to one calendar month — either a
    (year, month) tuple or a DHIS2 period id ('202609').  A hard pin is
    always honoured: if the month has no returns the payload comes back with
    status 'pending' rather than a wall of zeros, so the UI can say "awaiting
    September returns" instead of "Off Track" everywhere.  This is what the
    M1 tab uses.

    `default_period` SOFT-pins the anchor — the pinned Baseline month.  It is
    a preference, not a requirement: CHAK is used for that month when it has
    returns for it, and the latest reported month is used otherwise, so a
    stale or mistyped pin degrades the baseline instead of blanking it.

    With neither, the anchor follows the latest month that reported anything.

    Always returns a khis dict — on any failure the payload carries
    status 'empty'/'error'/'pending' and the UI simply keeps the placeholders.
    """
    khis = {
        "status": "error",
        "source": "CHAK DHIS2 (ereporting) · MOH 731 · Daraja facilities",
        "asOf": None,
        "matched": 0,
        "total": 0,
        "metrics": [],
        "note": "",
        "error": "",
    }
    try:
        daraja_names, ou_ids, matched = _daraja_scope()
        khis["total"] = len(daraja_names)
        khis["matched"] = matched
        if not ou_ids:
            khis["status"] = "empty"
            khis["note"] = (
                "No Daraja facility names matched CHAK DHIS2 org units."
            )
            return khis
        # CHAK can briefly return an empty analytics response while the
        # instance is under load. Do not turn that transient response into a
        # blank five-minute dashboard cache.
        #
        # The MOH 731 roll-up, the Tx_ML (IIT) read and the new TX_CURR
        # DSD/TPT/AHD breakdown are INDEPENDENT queries against the same
        # server and each takes 10-25 s, so they are issued concurrently.
        # The retry loop for the roll-up is unchanged and still runs to
        # completion; the other futures simply overlap it.
        from concurrent.futures import ThreadPoolExecutor

        data = {}
        iit_by_period = {}
        coc_by_period = {}
        with ThreadPoolExecutor(max_workers=3) as ex:
            fut_iit = ex.submit(_fetch_iit_numerator, ou_ids)
            fut_coc = ex.submit(_fetch_coc_breakdowns, ou_ids)
            for attempt in range(3):
                data = _fetch_daraja_metrics_data(ou_ids)
                if data:
                    break
                if attempt < 2:
                    time.sleep(2)
            try:
                iit_by_period = fut_iit.result() or {}
            except Exception as exc:  # noqa: BLE001
                print(f"[MILESTONE] CHAK IIT fetch failed: {exc}")
            try:
                coc_by_period = fut_coc.result() or {}
            except Exception as exc:  # noqa: BLE001
                print(f"[MILESTONE] CHAK COC breakdown fetch failed: {exc}")
        if not data:
            khis["status"] = "empty"
            khis["note"] = (
                "CHAK DHIS2 (ereporting) returned no MOH 731 rows for the "
                "matched Daraja facilities."
            )
            return khis

        latest = _pick_anchor_period(data)
        active = _periods_with_activity(data)

        def _resolve(spec):
            """(year, month) for a period spec — tuple, label or None."""
            if not spec:
                return None
            key = (tuple(spec) if not isinstance(spec, str)
                   else _pe_key(spec))
            return key if key and key[0] else None

        hard = _resolve(target_period)
        if hard is not None:
            if hard not in active:
                # Nothing has been entered for the requested month yet.  Say
                # so explicitly — scoring zeros would read as a cliff-edge
                # collapse in performance on every one of the nine metrics.
                khis["status"] = "pending"
                khis["pendingFor"] = _month_human(hard)
                khis["note"] = (
                    f"{_month_human(hard)} has no CHAK DHIS2 (MOH 731) "
                    f"returns yet across the {matched} matched Daraja "
                    f"facilities. Latest reporting month is "
                    f"{_month_human(_pe_key(latest)) or latest}. This tab "
                    "fills in automatically as soon as data entry for the "
                    "month starts."
                )
                return khis
            _anchor = active[hard]
        else:
            # Soft (pinned) month — a default, not a requirement.  Honour it so
            # the Baseline stays where it was set, but slide to the latest
            # reported month rather than blanking if CHAK has nothing for it.
            soft = _resolve(default_period)
            if soft in active:
                _anchor = active[soft]
                khis["pinnedFor"] = _month_human(soft)
            else:
                _anchor = latest

        _y, _m = _pe_key(_anchor)
        commodity = _khis_commodity_reporting(f"{_y:04d}{_m:02d}") if _y else {}
        metrics, anchor = _compute_daraja_metrics(
            data, _anchor, iit_by_period, commodity, coc_by_period
        )
        if not metrics:
            khis["status"] = "empty"
            khis["note"] = (
                "CHAK DHIS2 returned data, but no metric had a usable "
                "denominator for the latest reporting month."
            )
            return khis
        khis.update({
            "status": "ok",
            "asOf": anchor,
            "asOfHuman": _month_human(_pe_key(anchor)),
            "metrics": metrics,
            "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "note": (
                f"Baseline from the latest reporting month ({anchor}) across "
                f"{matched} Daraja facilities matched in CHAK DHIS2. "
                "GOR verification of each project month replaces this "
                "baseline with confirmed values."
            ),
        })
        soft = _resolve(default_period) if target_period is None else None
        if soft is not None and soft not in active:
            # The pin could not be honoured.  Say so on the face of the panel
            # rather than quietly showing a different month than promised.
            khis["note"] += (
                f" Baseline is pinned to {_month_human(soft)} "
                "(MILESTONE_BASELINE_PERIOD) but CHAK DHIS2 has no returns "
                "for that month, so this is the latest reported month "
                "instead."
            )
            khis.pop("pinnedFor", None)
        return khis
    except Exception as exc:  # noqa: BLE001
        khis["status"] = "error"
        khis["error"] = str(exc)
        return khis


def _attach_perf(rows, metrics):
    """Overlay a live CHAK DHIS2 baseline on a month's rows.

    The baseline is ONE measurement, so it lands on every project month
    rather than on M1 alone — the front-end renders "Monthly Payments -
    Earned" as the schedule max × the unlock % the baseline earns (with a
    "Final-pay max" variant for the M6 close-out tab) and documents the
    figure as an estimate that GOR verification of each project month
    replaces with confirmed values.

    Alerts.  A Summary2 seed is the GOR-verified status and always wins.
    Every OTHER row used to stay blank, which left the DHIS2-measured
    milestones with a PERFORMANCE figure, an EARNED figure and no Alerts
    chip — and made the Milestone Status donut report them all as "Not yet
    assessed".  Rows carrying a live baseline now band that baseline
    instead; `alertsSource` records which of the two the chip came from, so
    the UI can be explicit that a baseline alert is an estimate pending GOR
    verification.

    Safe to call more than once on the same rows: a stale baseline-derived
    alert is cleared first, so re-scoring a month against a different
    reporting period cannot leave the previous period's chip behind.
    """
    by_id = {m["id"]: m for m in (metrics or [])}
    for row in rows:
        perf = by_id.get(row["id"])
        if perf:
            row["perf"] = perf
        else:
            row.pop("perf", None)
        # Never clear a Summary2 seed — only a previous *baseline* guess.
        if row.get("alertsSource") == "baseline":
            row.pop("alerts", None)
            row.pop("alertsSource", None)
        if not row.get("alerts"):
            alert = _alert_for_unlock((perf or {}).get("unlock"))
            if alert:
                row["alerts"] = alert
                row["alertsSource"] = "baseline"


def _build_payload():
    """Parse the two workbooks once and shape the tracker API response."""
    # Open in read-only streaming mode: the parsers only ever read values,
    # and eager loading costs ~120 MB of Cell objects on the FAA workbook
    # alone (see _SheetView).
    faa_sheets = _open_for_values(
        FAA_XLSX,
        [
            "Milestones_DataEntry",
            "Payment Schedule_M1",
            "Payment Schedule_M2",
            "Payment Schedule_M3",
            "Payment Schedule_M4",
            "Payment Schedule_M5",
            "V2 Payment Schedule_Final Pay",
        ],
        read_only=True,
    )

    master = _parse_master_registry(faa_sheets["Milestones_DataEntry"])

    months = []
    for key, sheet_name in [
        ("M1", "Payment Schedule_M1"),
        ("M2", "Payment Schedule_M2"),
        ("M3", "Payment Schedule_M3"),
        ("M4", "Payment Schedule_M4"),
        ("M5", "Payment Schedule_M5"),
    ]:
        if sheet_name in faa_sheets:
            month = _parse_months_schedule(faa_sheets[sheet_name], key, sheet_name)
            if month:
                months.append(month)

    if "V2 Payment Schedule_Final Pay" in faa_sheets:
        m6 = _parse_v2_final_pay(faa_sheets["V2 Payment Schedule_Final Pay"])
        if m6:
            months.append(m6)

    # The seeds sheet is the only thing read from Summary2.
    seeds_sheets = _open_for_values(
        SUMMARY2_XLSX, ["Milestone Summary"], read_only=True
    )
    tracker_seeds = _parse_summary2(
        next(iter(seeds_sheets.values()))
    )

    # Enrich each month row with master allocation + Summary2 seeds.
    tier_set = set()
    for month in months:
        for row in month["rows"]:
            info = master.get(row["id"], {})
            row["allocation"] = info.get("allocation")
            row["masterName"] = info.get("name", "")
            row["milestoneType"] = info.get("milestoneType", "")
            if not row.get("name"):
                row["name"] = row["masterName"]
            if not row.get("tier"):
                row["tier"] = row["milestoneType"]
            seed = tracker_seeds.get(row["id"], {})
            row["paymentStatus"] = seed.get("paymentStatus")
            row["alerts"] = seed.get("alerts")
            row["verified"] = seed.get("verified")
            if row.get("tier"):
                tier_set.add(row["tier"])

    tiers = sorted(tier_set)
    award_total = months[-1]["cumulative"] if months else 0

    khis = _compute_khis_metrics(default_period=_baseline_period_ym())
    for month in months:
        _attach_perf(month["rows"], khis.get("metrics"))
        month["khis"] = khis

    # ── Baseline vs M1-Sep split ─────────────────────────────────────────
    # M1 covers September 2026, but the live CHAK baseline is anchored to the
    # month pinned in _BASELINE_PERIOD — August 2026 today.  One tab
    # therefore cannot say both things: it conflates "the September schedule"
    # with "August performance", and its alerts would swing the moment a
    # September return lands.
    #
    # So M1 is duplicated.  The copy becomes a frozen "Baseline" tab pinned to
    # the pinned month; the M1 tab itself is re-scored against the calendar
    # month its own sheet covers.  Until September returns arrive, M1 reports
    # status 'pending' instead of a row of zeros, and it lights up by itself
    # once data entry starts — no code change, no redeploy.  The Baseline tab
    # stays on its pinned month regardless, so a single early September
    # submission can never move it.
    if months:
        # The deep copy is taken AFTER the perf attach above, so the baseline
        # arrives already carrying the latest-reported-month scores, and the
        # two tabs' rows are fully independent objects — re-scoring M1 for
        # September cannot leak back into the August baseline.
        baseline = copy.deepcopy(months[0])
        baseline["key"] = "baseline"
        baseline["label"] = "Baseline"
        baseline["isBaseline"] = True
        baseline["khis"] = khis
        baseline["perfAsOf"] = khis.get("asOfHuman") or None
        months.insert(0, baseline)

    if len(months) > 1:
        m1 = months[1]
        m1_ym = _period_label_ym(m1.get("period"))
        if m1_ym:
            m1["label"] = f"M1 {_MONTH_NAMES[m1_ym[1] - 1][:3]}"
            khis_m1 = _compute_khis_metrics(target_period=m1_ym)
            m1["khis"] = khis_m1
            m1["perfAsOf"] = khis_m1.get("asOfHuman") or None
            _attach_perf(m1["rows"], khis_m1.get("metrics"))

    # ── #22 Digital Health Systems & Electronic Reporting Coverage ───────
    # Sourced from the NDWH's UJTP DWAPI upload workbook, NOT CHAK DHIS2,
    # so it is attached here rather than inside _compute_daraja_metrics.
    #
    # It lands on the BASELINE tab ONLY.  The workbook is the August
    # snapshot the Baseline is pinned to (MILESTONE_BASELINE_PERIOD); M1's
    # own month is October and its coverage figure does not exist yet, so
    # scoring M1 from this file would publish August's number under an
    # October heading.  Attaching after the M1 re-score above also keeps it
    # off M2–M6, which share the baseline's metrics list.
    #
    # Note this assigns row['perf'] directly instead of going through
    # _attach_perf(): that helper POPs 'perf' off every row whose id is
    # absent from the metrics list it is handed, so passing a single-metric
    # list would strip the nine CHAK baseline metrics off the tab.
    coverage = _dwapi_coverage()
    if coverage.get("status") == "ok" and coverage.get("pct") is not None:
        _cov_ym = _baseline_period_ym()
        if not _cov_ym:
            _cov_ym = _pe_key(
                str(coverage.get("latestMonth") or "").replace("-", ""))
        coverage["asOf"] = _month_human(_cov_ym) or coverage.get(
            "latestMonthHuman") or None
        _cov_metric = _metric_doc(
            22,
            "Digital Health Systems & Electronic Reporting Coverage",
            coverage["asOf"] or "latest upload",
            "≥95% of HIV facilities reporting electronically",
            coverage.get("actual") or "",
            coverage["pct"],
            coverage.get("unlock"),
            coverage.get("band"),
            coverage.get("formula") or "",
        )
        # The front-end's perf cell renders pct/actual/tooltip; the full
        # breakdown rides alongside so the panel can expand on it.
        _cov_metric["coverage"] = coverage
        for _month in months:
            if not _month.get("isBaseline"):
                continue
            for _row in _month.get("rows") or []:
                if _row.get("id") != 22:
                    continue
                _row["perf"] = _cov_metric
                # Same precedence as _attach_perf: a GOR-verified Summary2
                # seed always wins, otherwise band the coverage reading.
                if not _row.get("alerts"):
                    _alert = _alert_for_unlock(_cov_metric.get("unlock"))
                    if _alert:
                        _row["alerts"] = _alert
                        _row["alertsSource"] = "dwapi"
            _month["dwapi"] = coverage
            break
    else:
        # Disclose the gap on the Baseline tab rather than leaving #22
        # silently unscored with no explanation.
        for _month in months:
            if _month.get("isBaseline"):
                _month["dwapi"] = coverage
                break

    return {
        "ok": True,
        "title": "CHAK Daraka Project — Milestone Tracker & Payment Schedule",
        "workbook": "FAA_Monthly_Milestone_Plan_w_PaySched_CHAK_Revised",
        "awardTotal": award_total,
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "months": months,
        "tiers": tiers,
        "khis": khis,
        "dwapi": coverage,
    }


def _build_locked():
    """Build and store the payload. Caller must already hold _BUILD_LOCK."""
    global _MILESTONE_CACHE, _MILESTONE_CACHE_AT
    try:
        rebuilt = _build_payload()
    except Exception as exc:  # noqa: BLE001
        if _MILESTONE_CACHE is None:
            raise
        rebuilt = dict(_MILESTONE_CACHE)
        khis = dict(rebuilt.get("khis") or {})
        khis["status"] = "error"
        khis["note"] = (khis.get("note") or "") + \
            f" [auto-refresh failed: {exc}]"
        rebuilt["khis"] = khis
    # A transient CHAK DHIS2 hiccup must not blank a good baseline.  The
    # analytics layer swallows failed calls and returns {}, which surfaces
    # as khis.status == "empty" and would wipe every metric (including the
    # M1 perf rows) for a whole TTL.  Keep the last good payload instead
    # and disclose the skipped refresh in the note.
    if (
        (rebuilt.get("khis") or {}).get("status") != "ok"
        and ((_MILESTONE_CACHE or {}).get("khis") or {}).get("status") == "ok"
    ):
        status = (rebuilt.get("khis") or {}).get("status")
        reason = ((rebuilt.get("khis") or {}).get("note") or "").strip()
        kept = dict(_MILESTONE_CACHE)
        khis = dict(kept.get("khis") or {})
        note = (khis.get("note") or "").rstrip()
        note += (f" [Kept this baseline — the refresh returned "
                 f"'{status}' from CHAK DHIS2")
        if reason:
            note += f": {reason}"
        note += "]"
        khis["note"] = note
        kept["khis"] = khis
        rebuilt = kept
    _MILESTONE_CACHE = rebuilt
    _MILESTONE_CACHE_AT = time.time()
    return _MILESTONE_CACHE


_BACKGROUND_REFRESH = False


def _spawn_refresh():
    """Rebuild the payload on a daemon thread so no request blocks on it."""
    global _BACKGROUND_REFRESH
    with _REFRESH_DECISION_LOCK:
        if _BACKGROUND_REFRESH:
            return
        _BACKGROUND_REFRESH = True

    def _run():
        global _BACKGROUND_REFRESH
        try:
            with _BUILD_LOCK:
                _build_locked()
        except Exception as exc:  # noqa: BLE001
            print(f"[MILESTONE] Background refresh failed: {exc}")
        finally:
            with _REFRESH_DECISION_LOCK:
                _BACKGROUND_REFRESH = False

    threading.Thread(
        target=_run, name="milestone-refresh", daemon=True
    ).start()


def _fresh(payload, at):
    return payload is not None and (time.time() - at) <= _MILESTONE_TTL


class _PayloadWarming(Exception):
    """The payload is still being built and the caller must not wait for it."""


def _ensure_payload(force=False):
    """Return the tracker payload.  Never makes a request wait on a cold build.

    Cases:
      * fresh cache    -> return it
      * stale cache    -> return it now, refresh on a daemon thread
      * ?refresh=1     -> build synchronously (the caller explicitly asked)
      * nothing cached -> start the build on a daemon thread and raise
                          _PayloadWarming so the request answers instantly

    The last case is the important one.  A cold build loads both FAA workbooks
    and pulls LAST_12_MONTHS of MOH 731 from CHAK; when CHAK is unreachable
    that could take minutes.  Blocking the request on _BUILD_LOCK while it ran
    is exactly what made the Milestone tab hang for 2-6 minutes (measured
    380 s).  The route now answers 202 "warming" instead and the client
    re-polls, so the tab is usable immediately and fills in when the build
    lands.
    """
    if not force and _fresh(_MILESTONE_CACHE, _MILESTONE_CACHE_AT):
        return _MILESTONE_CACHE

    if force:
        with _BUILD_LOCK:
            if _fresh(_MILESTONE_CACHE, _MILESTONE_CACHE_AT):
                return _MILESTONE_CACHE
            return _build_locked()

    if _MILESTONE_CACHE is not None:
        # Serve the last good payload immediately; refresh behind the scenes.
        with _BUILD_LOCK:
            if _fresh(_MILESTONE_CACHE, _MILESTONE_CACHE_AT):
                return _MILESTONE_CACHE
            _spawn_refresh()
        return _MILESTONE_CACHE

    # Nothing cached.  Do NOT take _BUILD_LOCK: the boot pre-warm (or another
    # request) may already hold it, and waiting on it is the multi-minute hang
    # this function exists to avoid.
    if not _BUILD_LOCK.locked():
        _spawn_refresh()
    raise _PayloadWarming()


@milestone_bp.get("/api/milestone/data")
def milestone_data():
    """Return the full Milestone Tracker dataset (read-only).

    The payload is cached and auto-refreshed every _MILESTONE_TTL seconds
    so live CHAK DHIS2 (MOH 731) numbers stay fresh without a restart.
    Append ?refresh=1 to force an immediate rebuild.  If a rebuild fails
    the last good payload is kept (never blank the dashboard on a DHIS2
    hiccup); the failure is surfaced in the khis note.

    The cache is normally already warm thanks to _start_prewarm(); this
    route only pays for a build on a genuinely cold cache (e.g. the
    pre-warm failed) or an explicit ?refresh=1.
    """
    try:
        force = request.args.get("refresh") in ("1", "true", "yes")
        resp = jsonify(dict(_ensure_payload(force=force)))
        # This is a live snapshot with its own server-side TTL, so it must
        # never be stored by the browser or an intermediary: a cached copy
        # would outlive the cache it came from and pin a stale month of
        # numbers on the tracker.  (The warming branch below sets the same.)
        resp.headers["Cache-Control"] = "no-store, max-age=0"
        return resp
    except _PayloadWarming:
        resp = jsonify({
            "ok": False,
            "warming": True,
            "retryAfter": _WARMING_RETRY_SECONDS,
            "message": ("Milestone data is still being prepared from CHAK "
                        "DHIS2 — retrying shortly."),
        })
        resp.status_code = 202
        resp.headers["Retry-After"] = str(_WARMING_RETRY_SECONDS)
        resp.headers["Cache-Control"] = "no-store"
        return resp
    except Exception as exc:  # noqa: BLE001 - surface friendly error
        return jsonify({"ok": False, "error": str(exc)})
