"""Milestone Tracker: CHAK Daraka FAA monthly milestone plan + payment schedule.

Parses two local Excel workbooks (in train/):
  1. FAA_Monthly_Milestone_Plan_w_PaySched_CHAK_Revised.xlsx
     - Milestones_DataEntry  (master registry, unique Milestone IDs 1-26)
     - Payment Schedule_M1 .. M5  (per-month payment schedules)
     - V2 Payment Schedule_Final Pay  (Month-6 / final-pay schedule)
  2. Milestones Summary2.xlsx  (Summary2-style tracker layout + M1 seeds)

Serves a single read-only API:  GET /api/milestone/data
"""
from __future__ import annotations

import csv
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

FAA_XLSX = BASE_DIR / "FAA_Monthly_Milestone_Plan_w_PaySched_CHAK_Revised.xlsx"
SUMMARY2_XLSX = BASE_DIR / "Milestones Summary2.xlsx"

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
            _ensure_payload()
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
# (ids 6, 7, 8, 9, 11, 15, 16).  Every other milestone keeps "—" until its
# record-based / EMR-based verification happens.
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
})

_MONTH_ORD = {
    m: i for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep",
         "oct", "nov", "dec"]
    )
}

_DARJA_OUS_CACHE = None


def _daraja_scope():
    """Resolve the Daraja facility roster to CHAK DHIS2 org-unit ids.

    Reads train/Site_Census - Daraja.xlsx (the 259-facility merged
    Jamii Tekelezi + CHAP Stawisha census).  Each census row carries the
    national MFL code (col A) and the CHAK ereporting org units store the
    same code, so we match by MFL code first — this also catches the
    ~19 facilities whose CHAK display name differs from the census name
    (e.g. census 'Olkalou Sub-District Hospital' -> CHAK 'JM Kariuki
    Memorial County Referral Hospital').  Facilities with no code hit fall
    back to the local name index (all_chak_facilities.csv + CHAK MHUs.csv)
    with exact-first then containment matching.
    Returns (daraja_names, matched_ou_ids, matched_count).
    """
    global _DARJA_OUS_CACHE
    if _DARJA_OUS_CACHE is not None:
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
        csv_path = BASE_DIR.parent / "CHAK_Visuals_4_explore" / "all_chak_facilities.csv"
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
    return _DARJA_OUS_CACHE


def _fetch_chak_ou_by_code(codes):
    """Map CHAK ereporting org-unit codes (national MFL codes) to UIDs.

    Queries /api/organisationUnits.json with a code:in:[...] filter in
    chunks (URL-length safety).  Returns {} if CHAK is unreachable — the
    caller then falls back to name matching only.
    """
    mapping = {}
    try:
        import requests as _req
        from requests.auth import HTTPBasicAuth

        from services.dhis2 import CHAK_PASS, CHAK_USER

        base = "http://ereporting.chak.or.ke:8500/api"
        url = base + "/organisationUnits.json"
        auth = HTTPBasicAuth(CHAK_USER, CHAK_PASS)
        # Chunk below URL-length comfort; retry transient resets.
        for i in range(0, len(codes), 100):
            chunk = codes[i:i + 100]
            params = {
                "filter": "code:in:[" + ",".join(chunk) + "]",
                "fields": "id,code,level",
                "paging": "false",
            }
            for attempt in range(3):
                try:
                    resp = _req.get(url, params=params, auth=auth,
                                    timeout=90, verify=False)
                except Exception as exc:  # noqa: BLE001
                    if attempt == 2:
                        print(f"[MILESTONE] CHAK OU-by-code fetch "
                              f"failed (attempt {attempt + 1}): {exc}")
                        return {}
                    continue
                if not resp.ok:
                    print(f"[MILESTONE] CHAK OU-by-code HTTP "
                          f"{resp.status_code} on chunk {i // 100}")
                    return {}
                for ou in resp.json().get("organisationUnits", []) or []:
                    c = (ou.get("code") or "").strip()
                    if c and ou.get("level") == 5 and c not in mapping:
                        mapping[c] = ou["id"]
                break
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


def _pick_anchor_period(data):
    """Latest month (chronological) with any reported activity.

    Prefers the most recent month where TX_CURR > 0 (ART stock is the most
    reliably reported value), falling back to any month with data.
    """
    if not data:
        return None
    periods = set()
    for de_map in data.values():
        for p, v in (de_map or {}).items():
            if v:
                periods.add(p)
    if not periods:
        return None
    tx_periods = [
        p for p in periods
        if float(data.get(_DE_TX_CURR, {}).get(p, 0) or 0) > 0
    ]
    ordered = sorted(tx_periods or periods, key=_pe_key)
    return ordered[-1] if ordered else None


def _unlock_bands(band, pct):
    """Apply the FAA 'Payment Scale per Achievement Threshold' for a metric.

    band: 'count' (id 6/8), 'linkage' (7), 'iit' (9), 'ahd' (11),
          'tpt' (15), 'vl' (16).  pct is the 0–100 achievement measure.
    Returns (unlock_pct, band_label).
    """
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
    if band == "vl":  # id 16
        if pct >= 95:
            return 100, "≥95% VL suppression"
        if pct >= 80:
            return 80, "80–94% suppression"
        if pct >= 60:
            return 50, "60–79% suppression"
        return 0, "<60% suppression — no payment"
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


def _compute_daraja_metrics(data, anchor, iit_by_period=None):
    """Compute the seven DHIS2-measurable milestones for the anchor month.

    `iit_by_period` is the #9 numerator series ({period_label: value} of
    the "Interruption in Treatment" outcomes) supplied by
    `_fetch_iit_numerator`; it is a separate call because it needs the
    category-option breakdown.
    """
    if not data or not anchor:
        return [], None

    periods = _pe_lookup(data)

    def val(de_id, year, month):
        label = periods.get((year, month))
        if not label:
            return 0.0
        return float(data.get(de_id, {}).get(label, 0) or 0)

    year, month = _pe_key(anchor)
    q_year, q_month = _prev_quarter_close(year, month)

    tested = val(_IND_HTS_TESTED, year, month)
    positive = val(_IND_HTS_POSITIVE, year, month)
    tx_new = val(_DE_TX_NEW, year, month)
    tx_curr = val(_DE_TX_CURR, year, month)
    prep_new = val(_DE_PREP_NEW, year, month)
    vl_done = val(_DE_VL_DONE, year, month)
    vl_supp = val(_DE_VL_SUPPRESSED, year, month)
    tpt = val(_DE_TPT, year, month)
    tb_prev_num = val(_IND_TB_PREV_NUM, year, month)
    tb_prev_den = val(_IND_TB_PREV_DEN, year, month)
    iit_raw = float((iit_by_period or {}).get(anchor, 0) or 0)

    # #9 denominator: TX_CURR at the close of the PREVIOUS quarter, plus
    # every TX_NEW recorded so far in the CURRENT quarter.
    tx_curr_prevq = val(_DE_TX_CURR, q_year, q_month)
    tx_new_qtr = sum(
        val(_DE_TX_NEW, y, m) for y, m in _quarter_months_to(year, month)
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
            "official indicators HTS_TST / HTS_TST_POS : Numerator",
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
            "(TX_NEW: Starting ART ÷ HTS_TST_POS : Numerator)",
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
            "PrEP_New: PrEP, New Clients ÷ 486 (FAA monthly target) × 100 — "
            "CHAK DHIS2",
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
            "Interruption in Treatment ÷ [TX_CURR(previous quarter close) + "
            "TX_NEW(current quarter to date)] × 100 — CHAK DHIS2",
        ))

    # ── #11 Advanced HIV Disease (AHD) identification & evaluation ──
    #   Manager ruling:  (TX_NEW CD4 <200 + TX_NEW CD4 >=200) ÷ TX_NEW.
    #   Numerator = the two MOH 731 CD4 disaggregations of "TX_NEW:
    #   Starting ART"; denominator = TX_NEW: Starting ART itself.
    #   Target ≥90% (FAA row 13: "Proportion of adult PLHIV at risk of
    #   AHD who are screened for AHD using CD4 cell count or WHO staging
    #   criteria").
    if tx_new:
        cd4_lt200 = val(_DE_TX_NEW_CD4_LT200, year, month)
        cd4_ge200 = val(_DE_TX_NEW_CD4_GE200, year, month)
        cd4_known = cd4_lt200 + cd4_ge200
        ahd_pct = min(100.0, cd4_known / tx_new * 100.0)
        unlock, band = _unlock_bands("ahd", ahd_pct)
        metrics.append(_metric_doc(
            11, "Advanced HIV Disease (AHD) identification and evaluation",
            anchor,
            "≥90% of adult PLHIV at risk of AHD identified & evaluated",
            f"{ahd_pct:.1f}% · {fmt(cd4_known)} of {fmt(tx_new)} new ART "
            f"clients with CD4 established (<200 {fmt(cd4_lt200)} · "
            f"≥200 {fmt(cd4_ge200)})",
            ahd_pct, unlock, band,
            "(TX_NEW: Starting ART, CD4 <200 + CD4 >=200) ÷ TX_NEW: "
            "Starting ART × 100 — MOH 731 CD4 disaggregation, CHAK DHIS2",
        ))

    # ── #15 TB Preventive Therapy — 90% of eligible initiated ──
    #   Official CHAK DHIS2 indicator pair "TB_PREV Numerator Total" /
    #   "TB_PREV Denominator Total" = the WHO/NASCOP TPT coverage measure
    #   (facilities report it in the TB_PREV section of the MOH 731).
    #   Fractions, not counts: the denominator is small, so the value is
    #   BLENDED across every OU in the chunk in _chak_analytics_fetch.
    if tb_prev_den:
        tpt_pct = tb_prev_num / tb_prev_den * 100.0
        unlock, band = _unlock_bands("tpt", tpt_pct)
        metrics.append(_metric_doc(
            15, "TB Preventive Therapy", anchor,
            "90% of eligible PLHIV initiated on TPT",
            f"{tpt_pct:.1f}% · {fmt(tb_prev_num)} of {fmt(tb_prev_den)} "
            "eligible initiated",
            tpt_pct, unlock, band,
            "TB_PREV Numerator Total ÷ TB_PREV Denominator Total × 100 "
            "(CHAK DHIS2 official indicator)",
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
            "VL suppressed ÷ VL done (routine) × 100 — MOH 731",
        ))

    return metrics, anchor


def _compute_khis_metrics():
    """Resolve Daraja → CHAK DHIS2, fetch MOH 731, score the milestones.

    Always returns a khis dict — on any failure the payload carries
    status 'empty'/'error' and the UI simply keeps the placeholders.
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
        data = {}
        for attempt in range(3):
            data = _fetch_daraja_metrics_data(ou_ids)
            if data:
                break
            if attempt < 2:
                time.sleep(2)
        if not data:
            khis["status"] = "empty"
            khis["note"] = (
                "CHAK DHIS2 (ereporting) returned no MOH 731 rows for the "
                "matched Daraja facilities."
            )
            return khis
        iit_by_period = _fetch_iit_numerator(ou_ids)
        metrics, anchor = _compute_daraja_metrics(
            data, _pick_anchor_period(data), iit_by_period
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
            "metrics": metrics,
            "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "note": (
                f"Baseline from the latest reporting month ({anchor}) across "
                f"{matched} Daraja facilities matched in CHAK DHIS2. "
                "GOR verification of each project month replaces this "
                "baseline with confirmed values."
            ),
        })
        return khis
    except Exception as exc:  # noqa: BLE001
        khis["status"] = "error"
        khis["error"] = str(exc)
        return khis


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

    # Live performance (CHAK DHIS2 / Daraja baseline) for the seven
    # DHIS2-measurable milestones.  The baseline is attached to the FIRST
    # month only (M1) — it is a test of the indicator wiring, not yet the
    # confirmed performance of any project month.  M2–M6 keep "—" until
    # GOR verifies each project month's confirmed values.
    khis = _compute_khis_metrics()
    perf_by_id = {m["id"]: m for m in (khis.get("metrics") or [])}
    for month in months:
        if month.get("key") != "M1":
            continue
        for row in month["rows"]:
            perf = perf_by_id.get(row["id"])
            if perf:
                row["perf"] = perf

    return {
        "ok": True,
        "title": "CHAK Daraka Project — Milestone Tracker & Payment Schedule",
        "workbook": "FAA_Monthly_Milestone_Plan_w_PaySched_CHAK_Revised",
        "awardTotal": award_total,
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "months": months,
        "tiers": tiers,
        "khis": khis,
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
            _BACKGROUND_REFRESH = False

    threading.Thread(
        target=_run, name="milestone-refresh", daemon=True
    ).start()


def _fresh(payload, at):
    return payload is not None and (time.time() - at) <= _MILESTONE_TTL


def _ensure_payload(force=False):
    """Return the tracker payload, never making a request wait on a build.

    Three cases:
      * fresh cache           -> return it
      * stale cache           -> return it now, refresh on a daemon thread
      * no cache / ?refresh=1 -> build synchronously (cold start only;
                                 _start_prewarm() normally prevents this)

    Double-checked locking: a request that blocks behind the boot pre-warm
    re-checks freshness once it owns the lock, so it returns the payload
    the pre-warm just built instead of triggering a second full build.
    """
    if not force and _fresh(_MILESTONE_CACHE, _MILESTONE_CACHE_AT):
        return _MILESTONE_CACHE
    with _BUILD_LOCK:
        has_cache = _MILESTONE_CACHE is not None
        stale = not _fresh(_MILESTONE_CACHE, _MILESTONE_CACHE_AT)
        if not (stale or force):
            return _MILESTONE_CACHE
        if has_cache and not force:
            _spawn_refresh()
            return _MILESTONE_CACHE
        return _build_locked()


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
        return jsonify(dict(_ensure_payload(force=force)))
    except Exception as exc:  # noqa: BLE001 - surface friendly error
        return jsonify({"ok": False, "error": str(exc)})
