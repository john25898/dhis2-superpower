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


# ════════════════════════════════════════════════════════════════════
# LIVE PERFORMANCE — CHAK DHIS2 (ereporting · MOH 731) for DARAJA
#
# Only milestones whose target is measurable from DHIS2 get real numbers
# (ids 6, 7, 8, 9, 15, 16).  Every other milestone keeps "—" until its
# record-based / EMR-based verification happens.  The data-element ids and
# the ratio formulas below are the SAME proven set the app's Integrated
# HIV Dashboard pages already publish (train/pbix_dashboards.py PAGE 2).
# ════════════════════════════════════════════════════════════════════

# -- MOH 731 data-element ids (validated in pbix_dashboards.py) --------
_DE_HTS_TESTED = [
    "ymKviaHZtQN", "vFlUDposW0Y", "XKAlilawdhN", "THJbtDzxplR",
    "Lwtqyjus0Mb", "QBsyLQZRdiH", "XYhYAMivUX5", "J4zibSjbBCt",
]
_DE_HTS_POSITIVE = "CcOr3MB7Mh4"
_DE_HTS_LINKED_IN = ["wQ5AA7GTs9G", "YroUdlNVeR2", "h13L1gcUaCS"]
_DE_HTS_LINKED_OUT = ["DdPzCAtN3J2", "ZnetI7sd8Ub", "BeO9dmxTBMg"]
_DE_TX_CURR = "kgzd9LfXZXq"
_DE_IIT_TOTAL = "G9HTTIls3L6"   # Tx_ML, COD (IIT total)
_DE_TX_ML = "bv9nAL9x5Q5"       # Tx_ML, Outcomes (fallback numerator)
_DE_VL_DONE = "JGd3MwmKBuM"     # TX_PVLS (D) Routine  == VL done / eligible
_DE_VL_SUPPRESSED = "FloZph8hN9z"  # TX_PVLS (N) Routine
_DE_PREP_NEW = [
    "HmUEZ2yWtAE", "tSOqRYW3fUp", "CYLF8hUOHpv", "Q57YuHsnTKm",
    "OOhFACMqmKp", "hxfjIrnxHBF", "EmzN6C78vFE", "BSx4nKKwK1r",
    "mbSrJM6OvQo", "N3IsvP0sUF5", "DQR7sycvi6V", "JJsuQUWLYsD",
    "qvhr1STgYAD", "N6iP1PPLmyX", "EX7lZNXZXDe",
]
_DE_TPT = "dysZutXWPTz"

_ALL_METRIC_DE_IDS = sorted(
    set(
        [_DE_HTS_POSITIVE, _DE_TX_CURR, _DE_IIT_TOTAL, _DE_TX_ML,
         _DE_VL_DONE, _DE_VL_SUPPRESSED, _DE_TPT]
        + _DE_HTS_TESTED + _DE_HTS_LINKED_IN + _DE_HTS_LINKED_OUT
        + _DE_PREP_NEW
    )
)

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
    Jamii Tekelezi + CHAP Stawisha census) and matches each facility name
    against the CHAK ereporting org-unit index (all_chak_facilities.csv +
    CHAK MHUs.csv) — exact match first, containment fallback.
    Returns (daraja_names, matched_ou_ids, matched_count).
    """
    global _DARJA_OUS_CACHE
    if _DARJA_OUS_CACHE is not None:
        return _DARJA_OUS_CACHE

    daraja_names = []
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
                    daraja_names.append(name)
            wb.close()
    except Exception as exc:  # noqa: BLE001
        print(f"[MILESTONE] Daraja census parse failed: {exc}")

    # CHAK DHIS2 org-unit index (uid, lower-name)
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

    matched_ids = []
    for name in daraja_names:
        key = name.lower().strip()
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


def _pe_key(pe):
    """Sortable key for a DHIS2 period label ('202607', 'July 2026', …)."""
    s = str(pe).strip()
    m = re.match(r"^(\d{4})(\d{2})$", s)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    m = re.match(r"^([A-Za-z]+)[\s\-_/]*(\d{4})$", s)
    if m:
        return (int(m.group(2)), _MONTH_ORD.get(m.group(1).lower()[:3], 0))
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


def _period_sum(data, de_ids, period):
    total = 0.0
    for de in de_ids:
        total += float(data.get(de, {}).get(period, 0) or 0)
    return total


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

    band: 'count' (id 6/8), 'linkage' (7), 'iit' (9),
          'tpt' (15), 'vl' (16).  pct is the 0–100 achievement measure.
    Returns (unlock_pct, band_label).
    """
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


def _compute_daraja_metrics(data, anchor):
    """Compute the six DHIS2-measurable milestones for the anchor month."""
    if not data or not anchor:
        return [], None

    tested = _period_sum(data, _DE_HTS_TESTED, anchor)
    positive = float(data.get(_DE_HTS_POSITIVE, {}).get(anchor, 0) or 0)
    linked = (
        _period_sum(data, _DE_HTS_LINKED_IN, anchor)
        + _period_sum(data, _DE_HTS_LINKED_OUT, anchor)
    )
    tx_curr = float(data.get(_DE_TX_CURR, {}).get(anchor, 0) or 0)
    iit_raw = float(data.get(_DE_IIT_TOTAL, {}).get(anchor, 0) or 0)
    if not iit_raw:
        iit_raw = float(data.get(_DE_TX_ML, {}).get(anchor, 0) or 0)
    vl_done = float(data.get(_DE_VL_DONE, {}).get(anchor, 0) or 0)
    vl_supp = float(data.get(_DE_VL_SUPPRESSED, {}).get(anchor, 0) or 0)
    prep_new = _period_sum(data, _DE_PREP_NEW, anchor)
    tpt = float(data.get(_DE_TPT, {}).get(anchor, 0) or 0)

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
            "min(people tested ÷ 21,584, positives ÷ 306) — MOH 731 HTS "
            "entry-point total & HTS_POS",
        ))

    # ── #7 Linkage of HIV-positive clients to ART ──
    #   Target ≥95% of newly identified positives linked to ART.
    if positive:
        pct7 = min(100.0, linked / positive * 100.0)
        unlock, band = _unlock_bands("linkage", pct7)
        metrics.append(_metric_doc(
            7, "Linkage of HIV Positive Clients to ART", anchor,
            "≥95% of newly diagnosed linked to ART",
            f"{pct7:.1f}% · {fmt(linked)} of {fmt(positive)} linked",
            pct7, unlock, band,
            "linked (within + outside facility) ÷ HTS_POS × 100 — MOH 731",
        ))

    # ── #8 PrEP Initiation — monthly target 486 ──
    if prep_new:
        pct8 = min(100.0, prep_new / 486.0 * 100.0)
        unlock, band = _unlock_bands("count", pct8)
        metrics.append(_metric_doc(
            8, "PrEP Initiation", anchor,
            "486 PrEP initiations / month (2,918 / 6)",
            f"{fmt(prep_new)} PrEP initiations",
            pct8, unlock, band,
            "new PrEP starts ÷ 486 (FAA monthly target) — MOH 731 PrEP "
            "modalities total",
        ))

    # ── #9 HIV Care, Treatment Continuity & Retention (IIT) ──
    #   Target: monthly IIT < 2.0% of patients on ART.
    if tx_curr:
        iit_pct = iit_raw / tx_curr * 100.0
        unlock, band = _unlock_bands("iit", iit_pct)
        metrics.append(_metric_doc(
            9, "HIV Care, Treatment Continuity & Retention", anchor,
            "Monthly IIT < 2.0% of patients on ART",
            f"{iit_pct:.2f}% · {fmt(iit_raw)} interrupted of {fmt(tx_curr)} "
            "on ART",
            iit_pct, unlock, band,
            "Tx_ML (IIT total) ÷ TX_CURR × 100 — MOH 731",
        ))

    # ── #15 TB Preventive Therapy — 90% of eligible initiated ──
    #   Proxy (same as the app's Integrated HIV Dashboard): TPT ÷ TX_CURR.
    if tx_curr:
        tpt_pct = tpt / tx_curr * 100.0
        unlock, band = _unlock_bands("tpt", tpt_pct)
        metrics.append(_metric_doc(
            15, "TB Preventive Therapy", anchor,
            "90% of eligible PLHIV initiated on TPT",
            f"{fmt(tpt)} on TPT · {tpt_pct:.1f}% of TX_CURR "
            f"({fmt(tx_curr)})",
            tpt_pct, unlock, band,
            "TPT ÷ TX_CURR × 100 (eligible proxy) — MOH 731",
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
        data = _fetch_daraja_metrics_data(ou_ids)
        if not data:
            khis["status"] = "empty"
            khis["note"] = (
                "CHAK DHIS2 (ereporting) returned no MOH 731 rows for the "
                "matched Daraja facilities."
            )
            return khis
        metrics, anchor = _compute_daraja_metrics(data, _pick_anchor_period(data))
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

    # Live performance (CHAK DHIS2 / Daraja baseline) for the six
    # DHIS2-measurable milestones.  Same baseline is shown in every month
    # tab until GOR verifies that month's confirmed values.
    khis = _compute_khis_metrics()
    perf_by_id = {m["id"]: m for m in (khis.get("metrics") or [])}
    for month in months:
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
