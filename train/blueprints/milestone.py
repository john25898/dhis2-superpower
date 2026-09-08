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

import re
from datetime import date, datetime

import openpyxl
from flask import Blueprint, jsonify

from services.paths import BASE_DIR

milestone_bp = Blueprint("milestone", __name__)

_app = None  # set by register_milestone_blueprint

# ── Module-level cache (parsed once, reused across requests) ──
_MILESTONE_CACHE = None

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


# ── Small helpers ────────────────────────────────────────────────────
def _clean(value):
    """Collapse whitespace/newlines in a milestone name, strip edges."""
    if value is None:
        return ""
    text = str(value)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


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


def _build_payload():
    """Parse the two workbooks once and shape the tracker API response."""
    faa = openpyxl.load_workbook(FAA_XLSX, data_only=True)
    summary = openpyxl.load_workbook(SUMMARY2_XLSX, data_only=True)

    master = _parse_master_registry(faa["Milestones_DataEntry"])
    tracker_seeds = _parse_summary2(summary[summary.sheetnames[0]])

    months = []
    for key, sheet_name in [
        ("M1", "Payment Schedule_M1"),
        ("M2", "Payment Schedule_M2"),
        ("M3", "Payment Schedule_M3"),
        ("M4", "Payment Schedule_M4"),
        ("M5", "Payment Schedule_M5"),
    ]:
        if sheet_name in faa.sheetnames:
            month = _parse_months_schedule(faa[sheet_name], key, sheet_name)
            if month:
                months.append(month)

    if "V2 Payment Schedule_Final Pay" in faa.sheetnames:
        m6 = _parse_v2_final_pay(faa["V2 Payment Schedule_Final Pay"])
        if m6:
            months.append(m6)

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

    return {
        "ok": True,
        "title": "CHAK Daraka Project — Milestone Tracker & Payment Schedule",
        "workbook": "FAA_Monthly_Milestone_Plan_w_PaySched_CHAK_Revised",
        "awardTotal": award_total,
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "months": months,
        "tiers": tiers,
    }


@milestone_bp.get("/api/milestone/data")
def milestone_data():
    """Return the full Milestone Tracker dataset (read-only)."""
    global _MILESTONE_CACHE
    try:
        if _MILESTONE_CACHE is None:
            _MILESTONE_CACHE = _build_payload()
        payload = dict(_MILESTONE_CACHE)
        return jsonify(payload)
    except Exception as exc:  # noqa: BLE001 - surface friendly error
        return jsonify({"ok": False, "error": str(exc)})
