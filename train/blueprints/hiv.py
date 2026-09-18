"""HIV Treatment & Testing domain: live DHIS2 analytics endpoints."""
from __future__ import annotations

import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

import pandas as pd
from flask import Blueprint, jsonify, request

from services.common import _period_sort_key, json_safe
from services.dhis2 import (HTS_SPECS, INDICATOR_SPECS, DARAJA_SPECS,
                            _STA_TX_CURR_REGIMEN, _chak_analytics_coc_cells,
                            _chak_coc_name_totals,
                            COC_AGE_BANDS, COC_CELL_MAP, _dhis2_fetch,
                            CHAK_BASE, chak_get)
from services.ou_resolver import _resolve_ou_ids
from services.paths import BASE_DIR
from services.superpower import (
    HAS_SUPERPOWER,
    _superpower_fetch_result,
    _superpower_generate_url,
    _superpower_load_dict,
)

hiv_bp = Blueprint("hiv", __name__)

_app = None  # set by register_hiv_blueprint


def _fetch_spec_metric(mmeta: dict, ou_id, pe: str) -> dict:
    """Fetch one HTS/PrEP metric's period series.

    A metric may carry a ``typology_of`` data element (used by
    `prep_new_pbfw` / `prep_new_preg`).  That means: sum the metric's own
    (Stawisha) elements **plus** the named Jamii element restricted to the
    'PrEP Typologies' category option combos listed in
    ``typology_include`` — i.e. exactly the PBIX filter
    ``'PrEP Typologies'[PrEP Typologies] IN {"Pregnant","Breastfeeding"}``.

    A metric may instead carry ``cocs`` (used by `hts_positive_our`): the
    PBIX reaches `HTS Positive` with
    ``KEEPFILTERS('HIV Results'[HIV Results] == "HIV+")`` over the *same*
    testing elements, which DHIS2 expresses as a ``co:`` dimension filter.
    ``co:`` filtering only applies to the elements' OWN category combo, and
    these fetches come back keyed by ``(period, coc_id)`` — so they are
    collapsed back onto a plain ``{period: value}`` series here.

    ``extra_ids`` adds a second, UNFILTERED element list (the SNS
    "(Pos) - Tested peers" element, whose name already means positive).
    """
    cocs = mmeta.get("cocs")
    ids = list(mmeta.get("ids") or [])
    if cocs and ids:
        raw = _dhis2_fetch(";".join(ids), ou_id, pe, list(cocs)) or {}
        out: dict = {}
        for k, v in raw.items():
            per = k[0] if isinstance(k, tuple) else k
            out[per] = out.get(per, 0.0) + float(v or 0)
    elif ids:
        out = dict(_dhis2_fetch(";".join(ids), ou_id, pe, None) or {})
    else:
        # A metric may be defined purely by the ``typology_of`` Jamii element
        # (see `prep_new_preg`), in which case it has no standalone elements.
        out = {}

    extra_ids = mmeta.get("extra_ids")
    if extra_ids:
        for period, val in (_dhis2_fetch(";".join(extra_ids), ou_id, pe, None)
                            or {}).items():
            out[period] = out.get(period, 0.0) + float(val or 0)

    typo_de = mmeta.get("typology_of")
    if typo_de:
        jamii = _chak_coc_name_totals(
            typo_de, ou_id, pe,
            include=mmeta.get("typology_include") or ("preg", "breast"),
        )
        for period, val in jamii.items():
            out[period] = out.get(period, 0) + val
    return out


def register_hiv_blueprint(app):
    global _app
    _app = app
    app.register_blueprint(hiv_bp)
    print("[HIV] Blueprint registered")


@hiv_bp.get("/api/hiv-treatment/dhis-live")
def hiv_treatment_dhis_live() -> object:
    """Unified DHIS2 endpoint for all HIV Treatment subtabs.
    Params: ?type=tx_new|tx_curr|vl&county=...&subcounty=...&facility=...&period=LAST_12_MONTHS
    """

    qtype = (request.args.get("type") or "tx_new").strip().lower()
    county = (request.args.get("county") or "Meru County").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()

    # ── Check both INDICATOR_SPECS and DARAJA_SPECS ──
    spec = INDICATOR_SPECS.get(qtype)
    daraja_spec = DARAJA_SPECS.get(qtype) if not spec else None
    if not spec and not daraja_spec:
        return jsonify(json_safe({
            "error": f"Unknown type '{qtype}'. Use: tx_new, tx_curr, vl, art_optimization, dsd, treatment_outcomes, otz, ovc, covid, ahd, adverse_events"
        })), 400

    ou_id, is_multi_ou = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    # ── Daraja multi-metric type handling ──
    if daraja_spec:
        title = daraja_spec["title"]
        errors = []
        metrics_data = {}
        with ThreadPoolExecutor(max_workers=8) as ex:
            future_map = {}
            for mkey, mmeta in daraja_spec["metrics"].items():
                dx_str = ";".join(mmeta["ids"])
                fut = ex.submit(_dhis2_fetch, dx_str, ou_id, pe, None)
                future_map[fut] = mkey
            for fut in future_map:
                mkey = future_map[fut]
                try:
                    metrics_data[mkey] = fut.result()
                except Exception as exc:
                    errors.append(f"{daraja_spec['metrics'][mkey]['label']}: {exc}")
                    metrics_data[mkey] = {}

        all_set = set()
        for md in metrics_data.values():
            all_set.update(md.keys())
        all_periods = sorted(all_set, key=_period_sort_key)

        def _daraja_label(p):
            return f"{p[:4]}-{p[4:]}" if len(str(p)) == 6 else str(p)

        trend = []
        for p in all_periods:
            entry = {"period": p, "label": _daraja_label(p)}
            for mkey in daraja_spec["metrics"]:
                entry[mkey] = round(float(metrics_data.get(mkey, {}).get(p, 0)), 1)
            trend.append(entry)

        metric_list = []
        for mkey, mmeta in daraja_spec["metrics"].items():
            metric_list.append({"key": mkey, "label": mmeta["label"]})

        return jsonify(json_safe({
            "type": qtype,
            "title": title,
            "source": "dhis2_live",
            "county": county,
            "subcounty": sc_filter or None,
            "facility": fac_filter or None,
            "ou_id": ou_id,
            "period_range": pe,
            "metrics": metric_list,
            "trend": trend,
            "monthly_cards": [],
            "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "errors": errors if errors else None,
        }))

    title = spec["title"]

    # ── Get male/female COC IDs from spec ──
    male_cocs = spec.get("male_cocs", [])
    female_cocs = spec.get("female_cocs", [])
    age_bands = spec.get("age_bands", [])

    # ── Prepare parallel fetch: aggregate + COC-disaggregated ──
    fetch_specs = []
    # 1) Aggregate (single DX, no COC)
    fetch_specs.append(("total", spec["aggregate"]))

    if qtype in ("tx_new", "tx_curr"):
        # 2) Single COC-disaggregated query for all 30 age×sex combos
        all_cocs = male_cocs + female_cocs
        fetch_specs.append(("coc_data", spec["aggregate"]))
    elif qtype == "vl":
        # Fetch TX_PVLS (D) — the numerator
        pvls_d_id = spec.get("vl_pvls_d", "")
        if pvls_d_id:
            fetch_specs.append(("pvls_d_raw", pvls_d_id))
        # Fetch TX_CURR — the denominator
        tx_curr_spec = INDICATOR_SPECS.get("tx_curr", {})
        tx_curr_agg = tx_curr_spec.get("aggregate", "")
        if tx_curr_agg:
            fetch_specs.append(("tx_curr", tx_curr_agg))

    # ── Parallel fetch ──
    fetched = {}
    errors = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {}
        for key, dx in fetch_specs:
            cocs_for_key = None
            if key == "coc_data":
                cocs_for_key = all_cocs
            futures[executor.submit(_dhis2_fetch, dx, ou_id, pe, cocs_for_key)] = key
        for future in as_completed(futures):
            key = futures[future]
            try:
                fetched[key] = future.result()
            except Exception as exc:
                errors.append(f"{key}: {exc}")
                fetched[key] = {}

    # ── Build trend data ──
    total_data = fetched.get("total", {})
    all_periods = sorted(set(total_data.keys()), key=_period_sort_key)

    trend = []
    monthly_cards = []

    if qtype in ("tx_new", "tx_curr"):
        # COC-disaggregated data: dict of (period, coc_id) → value
        coc_data = fetched.get("coc_data", {})
        male_coc_set = set(male_cocs)
        female_coc_set = set(female_cocs)
        coc_to_age_idx = {}
        for i, cid in enumerate(male_cocs):
            coc_to_age_idx[cid] = ("male", i)
        for i, cid in enumerate(female_cocs):
            coc_to_age_idx[cid] = ("female", i)

        def to_label(p):
            return f"{p[:4]}-{p[4:]}" if len(str(p)) == 6 else str(p)

        for p in all_periods:
            total_val = round(float(total_data.get(p, 0)), 1)

            # Sum males and females from COC rows for this period
            male_val = 0.0
            female_val = 0.0
            male_band_sums = [0.0] * len(age_bands)
            female_band_sums = [0.0] * len(age_bands)

            for (cp, cid), val in coc_data.items():
                if cp != p:
                    continue
                info = coc_to_age_idx.get(cid)
                if not info:
                    continue
                sex, idx = info
                if sex == "male":
                    male_val += val
                    if idx < len(male_band_sums):
                        male_band_sums[idx] += val
                else:
                    female_val += val
                    if idx < len(female_band_sums):
                        female_band_sums[idx] += val

            male_bands = [{"age": a, "value": round(v, 1)} for a, v in zip(age_bands, male_band_sums)]
            female_bands = [{"age": a, "value": round(v, 1)} for a, v in zip(age_bands, female_band_sums)]

            trend.append({
                "period": p,
                "label": to_label(p),
                "total": total_val,
                "males": male_val,
                "females": female_val,
            })
            monthly_cards.append({
                "period": p,
                "label": to_label(p),
                "total": total_val,
                "males": male_val,
                "females": female_val,
                "male_bands": male_bands,
                "female_bands": female_bands,
            })

        return jsonify(json_safe({
            "type": qtype,
            "title": title,
            "source": "dhis2_live",
            "county": county,
            "subcounty": sc_filter or None,
            "facility": fac_filter or None,
            "ou_id": ou_id,
            "period_range": pe,
            "metrics": [
                {"key": "total", "label": f"{title} (Total)",
                 "color": spec["color_total"]},
                {"key": "males", "label": f"Males",
                 "color": spec["color_male"]},
                {"key": "females", "label": f"Females",
                 "color": spec["color_female"]},
            ],
            "age_bands": age_bands,
            "trend": trend,
            "monthly_cards": monthly_cards,
            "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "errors": errors if errors else None,
        }))

    elif qtype == "vl":
        def to_label(p):
            return f"{p[:4]}-{p[4:]}" if len(str(p)) == 6 else str(p)

        pvls_d_data = fetched.get("pvls_d_raw", {})
        tx_curr_data = fetched.get("tx_curr", {})
        for p in all_periods:
            pvls_d_val = float(pvls_d_data.get(p, 0)) or 0
            tx_curr_val = float(tx_curr_data.get(p, 0)) or 0
            vl_uptake = round(
                (pvls_d_val / tx_curr_val * 100) if tx_curr_val > 0 else 0, 1
            )
            entry = {
                "period": p,
                "label": to_label(p),
                "pvls_d": pvls_d_val,
                "tx_curr": tx_curr_val,
                "vl_uptake": vl_uptake,
            }
            trend.append(entry)
            monthly_cards.append(entry)

        metric_list = [
            {"key": "pvls_d", "label": "TX_PVLS (D)"},
            {"key": "tx_curr", "label": "TX_CURR"},
            {"key": "vl_uptake", "label": "% VL Uptake"},
        ]

        return jsonify(json_safe({
            "type": qtype,
            "title": title,
            "source": "dhis2_live",
            "county": county,
            "subcounty": sc_filter or None,
            "facility": fac_filter or None,
            "ou_id": ou_id,
            "period_range": pe,
            "metrics": metric_list,
            "trend": trend,
            "monthly_cards": monthly_cards,
            "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "errors": errors if errors else None,
        }))


# ── Unified DHIS2 Live Query for HIV Testing subtabs ──────────────
@hiv_bp.get("/api/hiv-testing/dhis-live")
def hiv_testing_dhis_live() -> object:
    """Unified DHIS2 endpoint for all HIV Testing subtabs.
    Params: ?type=hts_uptake|hts_linkage|partner_notification|prep
            &county=...&subcounty=...&facility=...
    Delivers 3-metric multi-line chart data per subtab.
    """
    qtype = (request.args.get("type") or "hts_uptake").strip().lower()
    county = (request.args.get("county") or "Meru County").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()

    spec = HTS_SPECS.get(qtype)
    if not spec:
        return jsonify(json_safe({
            "error": f"Unknown type '{qtype}'. Use: hts_uptake, hts_linkage, partner_notification, prep"
        })), 400

    title = spec["title"]
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    errors = []
    metrics_data = {}

    # Fetch each metric in parallel
    with ThreadPoolExecutor(max_workers=6) as ex:
        future_map = {}
        for mkey, mmeta in spec["metrics"].items():
            fut = ex.submit(_fetch_spec_metric, mmeta, ou_id, pe)
            future_map[fut] = mkey
        for fut in future_map:
            mkey = future_map[fut]
            try:
                metrics_data[mkey] = fut.result()
            except Exception as exc:
                errors.append(f"{spec['metrics'][mkey]['label']}: {exc}")
                metrics_data[mkey] = {}

    # Collect all period keys across all metrics
    all_set = set()
    for md in metrics_data.values():
        all_set.update(md.keys())
    all_periods = sorted(all_set, key=_period_sort_key)

    def _hts_label(p):
        return f"{p[:4]}-{p[4:]}" if len(str(p)) == 6 else str(p)

    trend = []
    for p in all_periods:
        entry = {"period": p, "label": _hts_label(p)}
        for mkey in spec["metrics"]:
            entry[mkey] = round(
                float(metrics_data.get(mkey, {}).get(p, 0)), 1
            )
        # hts_uptake: fold the two project sections back together into the
        # PBIX figures `HTS Tested` = our + other and `HTS Positive` =
        # our + other.  The individual halves stay on the row so the split is
        # still visible to the UI.
        if qtype == "hts_uptake":
            tested = (float(metrics_data.get("hts_tested_our", {}).get(p, 0))
                      + float(metrics_data.get("hts_tested_other", {}).get(p, 0)))
            positive = (float(metrics_data.get("hts_positive_our", {}).get(p, 0))
                        + float(metrics_data.get("hts_positive_other", {}).get(p, 0)))
            entry["hts_tested"] = round(tested, 1)
            entry["hts_positive"] = round(positive, 1)
            entry["positivity_rate"] = round(
                (positive / tested * 100) if tested > 0 else 0, 1
            )
        trend.append(entry)

    if qtype == "hts_uptake":
        metric_list = [
            {"key": "hts_tested", "label": "HTS Tested (JTP + Stawisha)"},
            {"key": "hts_positive", "label": "HTS Positive (JTP + Stawisha)"},
            {"key": "positivity_rate", "label": "HTS TST % Positive", "is_pct": True},
            {"key": "hts_tested_our", "label": "Tested - JTP (Jamii/Daraja)"},
            {"key": "hts_tested_other", "label": "Tested - CHAP Stawisha"},
            {"key": "hts_positive_our", "label": "Positive - JTP (Jamii/Daraja)"},
            {"key": "hts_positive_other", "label": "Positive - CHAP Stawisha"},
        ]
    else:
        metric_list = [
            {"key": mk, "label": mm["label"]}
            for mk, mm in spec["metrics"].items()
            if not mm.get("split")
        ]

    return jsonify(json_safe({
        "type": qtype,
        "title": title,
        "source": "dhis2_live",
        "county": county,
        "subcounty": sc_filter or None,
        "facility": fac_filter or None,
        "ou_id": ou_id,
        "period_range": pe,
        "metrics": metric_list,
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors if errors else None,
    }))


# ── DHIS2 Live Query: NART Trend via Superpower ────────────────────
@hiv_bp.get("/api/hiv-treatment/nart-dhis-live")
def nart_dhis_live() -> object:
    """Query DHIS2 via the superpower module for 3 NART metrics.
    Routes the natural-language question through ai_translator's
    generate_dhis2_url + fetch_query_result pipeline.
    Params: ?county=...&subcounty=...&facility=...
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    ou_id, is_multi_ou = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    # ── 3 metric groups ──
    DX_TOTAL = "gv7bbGesTTJ"
    MALE_DX = [
        "rpL7wMYNPDH","s9iBEnfSHhh","JprDjnAyB0f","PG5Ynz9xGCu",
        "SNOcc1Tq2iH","VqYNMLji5U5","wJWCrZVh1iu","jjXJNig8fxs",
        "Lbs5RUpnwPD","cQrYHDWkY2y","QRV2YRNGYJ6","Mt9G8jCODUw",
        "FDRjPKGGVC9","ShO7o3bHsNr","ivLPgJtKgcN",
    ]
    ADULT_15P_DX = (
        set(MALE_DX) - {"rpL7wMYNPDH","s9iBEnfSHhh","JprDjnAyB0f","PG5Ynz9xGCu"}
    ) | {
        "NBMvd95wp7t","X7QikQUsYB1","MOqDhGiw7W6","BFbmB3WxGPd",
        "xz2f0oONxQx","f59E1kimKqe","UjIzCVxESAz","Y4jKOMblgII",
        "hUHq4KO9YMz","tWTgIibsKJ5","AFdikiNpC3e","GMoRCzegC6C",
        "Bs5etPcLz7w","Ps8a7Mv1xIn","sQcd8UD8Mrs",
    }

    # CHAK_BASE is the single canonical CHAK endpoint (TLS, port 443).
    url_base = CHAK_BASE.rstrip("/") + "/analytics.json"
    pe = "LAST_12_MONTHS"

    # ── Step 1: Superpower generates URL for the TOTAL metric ──
    superpower_url = None
    if HAS_SUPERPOWER:
        try:
            question = (
                f"Tx_New STA for {county} over the last 12 months"
            )
            superpower_url = _superpower_generate_url(question)
            if superpower_url:
                print(f"[Superpower] Generated URL: {superpower_url[:120]}...")
        except Exception as exc:
            print(f"[Superpower] generate_dhis2_url failed: {exc}")

    # ── Step 2: Superpower fetch for all 3 metric groups ──
    def fetch_via_superpower(dx_ids):
        """Build URL & fetch through superpower's fetch_query_result."""
        if isinstance(dx_ids, (list, set, tuple)):
            dx_str = ";".join(dx_ids)
        else:
            dx_str = dx_ids
        if isinstance(ou_id, (list, set, tuple)):
            ou_str = ";".join(ou_id)
        else:
            ou_str = ou_id
        api_url = (
            f"{url_base}?"
            f"dimension=dx:{dx_str}"
            f"&dimension=pe:{pe}"
            f"&dimension=ou:{ou_str}"
            f"&displayProperty=NAME"
        )
        if HAS_SUPERPOWER:
            result = _superpower_fetch_result(api_url)
            if result.get("ok") and result.get("rows"):
                return result["rows"]
            # fallback: superpower failed, use direct
        from requests.auth import HTTPBasicAuth
        username = os.getenv("DHIS_USERNAME", "Johnbrian")
        password = os.getenv("DHIS_PASSWORD", "JOHNb123\\")
        auth = HTTPBasicAuth(username, password)
        # Route through the shared CHAK client so the canonical base, the
        # connect/read timeouts and the circuit breaker all apply here too.
        try:
            resp = chak_get("/analytics.json", {
                "dimension": [f"dx:{dx_str}", f"pe:{pe}", f"ou:{ou_str}"],
                "displayProperty": "NAME",
            }, read_timeout=120, auth=auth)
        except Exception as exc:
            print(f"[HIV] CHAK analytics fetch failed: {exc}")
            return []
        if not resp.ok:
            return []
        data = resp.json()
        hdrs = [h.get("name","").lower() for h in data.get("headers",[])]
        pe_i = next((i for i,h in enumerate(hdrs) if h in ("pe","period")), 0)
        val_i = next((i for i,h in enumerate(hdrs) if h=="value"), len(hdrs)-1)
        rows = data.get("rows", [])
        meta = data.get("metaData",{}).get("items",{})
        out = []
        for row in rows:
            pe_name = meta.get(str(row[pe_i]),{}).get("name", str(row[pe_i]))
            out.append({"period": pe_name, "value": float(row[val_i]) if row[val_i] else 0})
        return out

    def aggregate_by_period(rows):
        """Sum values by period from superpower-style rows."""
        result = {}
        for r in rows:
            p = str(r.get("period", ""))
            v = float(r.get("value", 0))
            result[p] = result.get(p, 0) + v
        return result

    try:
        total_rows = fetch_via_superpower(DX_TOTAL)
        males_rows = fetch_via_superpower(MALE_DX)
        adults_rows = fetch_via_superpower(ADULT_15P_DX)

        total_data = aggregate_by_period(total_rows)
        males_data = aggregate_by_period(males_rows)
        adults_data = aggregate_by_period(adults_rows)

        all_periods = sorted(set(
            list(total_data.keys()) +
            list(males_data.keys()) +
            list(adults_data.keys())
        ), key=_period_sort_key)

        def to_label(p):
            return f"{p[:4]}-{p[4:]}" if len(str(p)) == 6 else str(p)

        trend = []
        for p in all_periods:
            trend.append({
                "period": p,
                "label": to_label(p),
                "total": round(float(total_data.get(p, 0)), 1),
                "males": round(float(males_data.get(p, 0)), 1),
                "adults_15plus": round(float(adults_data.get(p, 0)), 1),
            })

        return jsonify(json_safe({
            "source": "dhis2_superpower",
            "county": county,
            "subcounty": sc_filter or None,
            "facility": fac_filter or None,
            "ou_id": ou_id,
            "period_range": pe,
            "superpower_url": superpower_url,
            "metrics": [
                {"key": "total", "label": "Newly Started on ART (Total)"},
                {"key": "males", "label": "Males Started on ART"},
                {"key": "adults_15plus", "label": "Adults Started on ART (15+ Yrs)"},
            ],
            "trend": trend,
            "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }))
    except Exception as exc:
        return jsonify(json_safe({
            "error": f"Superpower DHIS2 query failed: {str(exc)}"
        })), 500


# ── DHIS2 Live Query: Newly Started on ART ───────────────────────────
@hiv_bp.get("/api/dhis/query-art")
def dhis_query_art() -> object:
    """Query Newly Started on ART (Tx_New) from live DHIS2 only.
    ALWAYS fetches LAST_6_MONTHS for trend data; filters on frontend side.
    """
    facility = (request.args.get("facility") or "").strip()
    month = (request.args.get("month") or "").strip()
    county = (request.args.get("county") or "").strip()
    subcounty = (request.args.get("subCounty") or "").strip()

    DX_TX_NEW = "gv7bbGesTTJ"
    username = os.getenv("DHIS_USERNAME") or "Johnbrian"
    password = os.getenv("DHIS_PASSWORD") or "JOHNb123\\"

    all_rows = []
    total = 0
    total_requested_month = 0

    # ── Helper: resolve org unit name → ID ──────────────────────────
    # Known county UIDs
    KNOWN_COUNTIES = {
        "meru": "Y52XNJ50hYb",
        "kiambu": "uYVuOOi3Sdo",
        "nairobi": "HjfgtUvCQmM",
        "mombasa": "YqRHObuZC00",
        "kisumu": "HhOLwQKSAfM",
        "makueni": "Q0Fqz15LkGk",
        "kitui": "COSuCgBjjM3",
        "machakos": "HfLKw6JcHdv",
        "kilifi": "NG7ZEAV0hy4",
    }

    def resolve_ou(name, search_type="facility"):
        """search_type: 'facility' or 'county'"""
        name_lower = name.lower().strip()
        # For county lookups, use known counties mapping directly
        if search_type == "county":
            for county_name, uid in KNOWN_COUNTIES.items():
                if name_lower == county_name or name_lower.startswith(county_name):
                    return uid
            return None
        # For facility lookups, use the facilities dictionary
        try:
            _, df_fac = _superpower_load_dict()
            m = df_fac[df_fac["name"].str.lower().str.contains(name_lower, na=False)]
            if not m.empty:
                fac = m[m["level"].astype(str) == "5"]
                if not fac.empty:
                    return fac.iloc[0]["id"]
                return m.iloc[0]["id"]
        except Exception:
            pass
        return None

    # ── Source 1: Live DHIS2 ─────────────────────────────────────────
    from requests.auth import HTTPBasicAuth

    auth = HTTPBasicAuth(username, password)

    ou_id = None
    ou_label = "All Facilities"
    if facility and facility.lower() != "all":
        ou_id = resolve_ou(facility, "facility") or "uwvOG2N2Cmt"
        ou_label = facility
    elif county and county.lower() != "all":
        ou_id = resolve_ou(county, "county") or "Y52XNJ50hYb"
        ou_label = county

    # Always fetch LAST_6_MONTHS for rich trend data
    pe = "LAST_6_MONTHS"
    month_clean = ""
    if month and month.lower() != "all":
        month_clean = re.sub(r"[^0-9]", "", month)[:6]

    params = {"dimension": [f"dx:{DX_TX_NEW}", f"pe:{pe}"]}
    if ou_id:
        params["dimension"].append(f"ou:{ou_id}")

    try:
        resp = chak_get("/analytics.json", params, read_timeout=120,
                        auth=auth)
        if resp.ok:
            dhis_data = resp.json()
            # Map column names from response headers
            headers = [h.get("name", "").lower() for h in dhis_data.get("headers", [])]
            col_map = {name: i for i, name in enumerate(headers)}
            dx_idx = col_map.get("dx", 0)
            ou_idx = col_map.get("ou")  # None if ou not in response
            pe_idx = col_map.get("pe", 2)
            val_idx = col_map.get("value", 3)

            meta = dhis_data.get("metaData", {})
            items_map = {k: v.get("name", k) for k, v in meta.get("items", {}).items()}

            for row in dhis_data.get("rows", []):
                pe_str = row[pe_idx] if len(row) > pe_idx and row[pe_idx] else pe
                val = float(row[val_idx]) if len(row) > val_idx and row[val_idx] else 0
                ou_code = ""
                ou_name = ou_label or "All"
                if ou_idx is not None and len(row) > ou_idx and row[ou_idx]:
                    ou_code = row[ou_idx]
                    ou_name = items_map.get(ou_code, ou_code)
                pe_label = items_map.get(pe_str, pe_str) if pe_str else pe_str
                row_data = {
                    "period": pe_str,
                    "period_label": pe_label,
                    "org_unit": ou_name,
                    "org_unit_id": ou_code,
                    "facility": ou_name,
                    "value": val,
                    "source": "live_dhis2",
                }
                all_rows.append(row_data)
                total += val
                # Track total for the specifically requested month
                if month_clean and pe_str == month_clean:
                    total_requested_month += val
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": f"DHIS2 query failed: {str(exc)}"}))

    # Sort by period
    all_rows.sort(key=lambda r: str(r.get("period", "")))

    return jsonify(json_safe({
        "ok": True,
        "indicator": "Newly Started on ART (Tx_New STA)",
        "total": total,
        "total_requested_month": total_requested_month if month_clean else total,
        "requested_month": month_clean,
        "rows": all_rows,
        "row_count": len(all_rows),
        "org_unit": ou_id or "all",
        "org_unit_label": ou_label,
        "period": pe,
    }))


# ── Generic DHIS2 query (any indicator) ───────────────────────────────
@hiv_bp.get("/api/dhis/query")
def dhis_query() -> object:
    """Generic DHIS2 query — pass ?q=your question."""
    question = (request.args.get("q") or "").strip()
    if not question:
        return jsonify(json_safe({"ok": False, "error": "Missing 'q' parameter"}))

    if not HAS_SUPERPOWER:
        return jsonify(json_safe({"ok": False, "error": "Superpower module not available"}))

    try:
        url = _superpower_generate_url(question)
        if not url:
            return jsonify(json_safe({"ok": False, "error": "No URL generated", "question": question}))
        result = _superpower_fetch_result(url, user_question=question)
        return jsonify(json_safe({
            "ok": result.get("ok", False),
            "question": question,
            "url": url,
            "total": result.get("total", 0),
            "rows": result.get("rows", []),
            "error": result.get("error"),
            "message": result.get("message"),
        }))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500


# ── TX_CURR Analytics: Gender Breakdown ────────────────────────────
@hiv_bp.get("/api/hiv-treatment/tx-curr-gender")
def tx_curr_gender() -> object:
    """TX_CURR by gender for the selected location.
    ?county=...&subcounty=...&facility=...&period=LAST_12_MONTHS
    Returns {period_series: [...], latest_gender: {Male: N, Female: N}}
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)
    TX_CURR_DX = INDICATOR_SPECS["tx_curr"]["aggregate"]

    try:
        raw = _dhis2_fetch(TX_CURR_DX, ou_id, pe, None)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500
    return jsonify(json_safe({"ok": True, "data": raw}))


# ── TX_CURR Analytics: By Finer Age Group ─────────────────────────
@hiv_bp.get("/api/hiv-treatment/tx-curr-age")
def tx_curr_age() -> object:
    """TX_CURR by finer age group for the selected location.
    ?county=...&subcounty=...&facility=...&pe=202601 (single month)
    Returns {period, age_data: [{age, value}]}
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("pe") or "202605").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)
    TX_CURR_DX = INDICATOR_SPECS["tx_curr"]["aggregate"]
    AGE_DIM = "PiDJ9GbMZ0B"

    try:
        raw = _dhis2_fetch(TX_CURR_DX, ou_id, pe, None)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500
    return jsonify(json_safe({"ok": True, "data": raw, "period": pe}))


# ── TX_CURR Analytics: Yearly Trends ──────────────────────────────
@hiv_bp.get("/api/hiv-treatment/tx-curr-yearly")
def tx_curr_yearly() -> object:
    """TX_CURR yearly totals for the selected location.
    ?county=...&subcounty=...&facility=...&pe=2023;2024;2025;2026
    Returns {data: {year_label: value}}
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("pe") or "2023;2024;2025;2026").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)
    TX_CURR_DX = INDICATOR_SPECS["tx_curr"]["aggregate"]

    try:
        raw = _dhis2_fetch(TX_CURR_DX, ou_id, pe, None)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500
    return jsonify(json_safe({"ok": True, "data": raw}))


# ── TX_CURR Analytics: MMD Breakdown ──────────────────────────────
@hiv_bp.get("/api/hiv-treatment/tx-curr-mmd")
def tx_curr_mmd() -> object:
    """TX_CURR MMD regimen breakdown for the selected location.
    ?county=...&subcounty=...&facility=...&period=LAST_12_MONTHS
    Returns {period_series: {...}, latest_data: {regimen_label: value}}
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    MMD_DX = (
        # Real MMD measures: "TX_CURR_MMD" + "TX_CURR on MMD".
        # The old list mashed the ART-regimen elements (JOldQxWZWso …) into
        # this chart, which made the bar heights meaningless.
        "TNAf1ystLF3;g8mOybcTwmL"
    )

    try:
        raw = _dhis2_fetch(MMD_DX, ou_id, pe, None)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500
    return jsonify(json_safe({"ok": True, "data": raw}))


# ── TX_CURR Analytics: Month-on-Month Change ──────────────────────
@hiv_bp.get("/api/hiv-treatment/tx-curr-mom")
def tx_curr_mom() -> object:
    """TX_CURR month-on-month change for the selected location.
    ?county=...&subcounty=...&facility=...&period=LAST_12_MONTHS
    Returns {changes: [{period, current, previous, change, change_pct}]}
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)
    TX_CURR_DX = INDICATOR_SPECS["tx_curr"]["aggregate"]

    try:
        raw = _dhis2_fetch(TX_CURR_DX, ou_id, pe, None)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500

    # Compute MoM changes
    from datetime import datetime

    def _parse_period(label):
        m = re.match(r"(\w+)\s+(\d{4})", label)
        if m:
            return datetime.strptime(f"{m.group(1)} {m.group(2)}", "%B %Y")
        return datetime.min

    sorted_periods = sorted(raw.items(), key=lambda x: _parse_period(x[0]))
    changes = []
    for i in range(1, len(sorted_periods)):
        prev_label, prev_val = sorted_periods[i-1]
        curr_label, curr_val = sorted_periods[i]
        change = curr_val - prev_val
        change_pct = round((change / prev_val * 100), 1) if prev_val else 0
        changes.append({
            "period": curr_label,
            "current": curr_val,
            "previous": prev_val,
            "change": change,
            "change_pct": change_pct,
        })

    return jsonify(json_safe({"ok": True, "changes": changes}))


# ── Daraja Regimen Distribution (like DHIS2 TX_Curr Regimens) ──────
@hiv_bp.get("/api/hiv-treatment/daraja-regimens")
def daraja_regimens() -> object:
    """Fetches Daraja regimen data for donut chart.
    ?county=...&subcounty=...&facility=...&period=LAST_12_MONTHS
    Uses ART Optimization DX IDs: 1st Line, 2nd Line, 3rd Line, DTG
    Returns {ok, regimens: [{label, id, value}], latest_period}
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    # Live ART regimen split.  The old "C&T (facility) - ART Regimen
    # Monitoring" ids (zZGNba5d34c …) return zero for BOTH Daraja projects;
    # these are the CHAP Stawisha (62-facility) regimen elements that carry
    # the actual data, plus the Jamii equivalents where they exist.
    REGIMEN_DX = dict(_STA_TX_CURR_REGIMEN)
    dx_all = ";".join(REGIMEN_DX.values())

    try:
        raw = _dhis2_fetch(dx_all, ou_id, pe, None)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500

    # Group by period
    period_data: dict[str, dict[str, float]] = defaultdict(dict)
    # raw is {"Period Label": total_value} with all regimens summed together
    # Need to fetch separately per DX
    regimens = []
    latest_period = ""
    try:
        with ThreadPoolExecutor(max_workers=6) as executor:
            fut_map = {}
            for label, dx_id in REGIMEN_DX.items():
                fut = executor.submit(_dhis2_fetch, dx_id, ou_id, pe, None)
                fut_map[fut] = label
            for fut in as_completed(fut_map):
                label = fut_map[fut]
                try:
                    data = fut.result()
                except Exception:
                    data = {}
                # Get latest non-zero value
                sorted_periods = sorted(data.keys(), key=_period_sort_key)
                val = 0
                lp = ""
                for p in reversed(sorted_periods):
                    v = round(float(data.get(p, 0)), 1)
                    if v > 0:
                        val = v
                        lp = p
                        break
                regimens.append({"label": label, "id": REGIMEN_DX[label], "value": val, "period": lp})
                if lp and lp > latest_period:
                    latest_period = lp
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500

    # Calculate total
    total = sum(r["value"] for r in regimens)
    return jsonify(json_safe({
        "ok": True,
        "regimens": regimens,
        "total": total,
        "latest_period": latest_period,
    }))


# ── TX_CURR by Gender (Male/Female aggregate from DX elements) ──
@hiv_bp.get("/api/hiv-treatment/tx-curr-gender-split")
def tx_curr_gender_split() -> object:
    """TX_CURR Male vs Female from gender-specific DX elements.
    ?county=...&subcounty=...&facility=...&period=LAST_12_MONTHS
    Returns {ok, male: N, female: N, latest_period, trend: [{period, male, female}]}
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    # Both Daraja funding namespaces (84477 Jamii Tekelezi, 85745 CHAP
    # Stawisha) share the SAME 30 age x sex COCs, so one COC-split request
    # over the union of the two TX_CURR elements covers all 259 facilities.
    # (The old code used the CHAP-only "TX_Curr STA <band>,F/M" indicators,
    # which returned 0 for the 187 Jamii facilities.)
    TX_CURR_DX = INDICATOR_SPECS["tx_curr"]["aggregate"]

    try:
        cells = _chak_analytics_coc_cells(TX_CURR_DX, ou_id, pe)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500

    all_periods = sorted(cells.keys(), key=_period_sort_key)
    trend = []
    for p in all_periods:
        f_val = m_val = 0.0
        for uid, val in cells.get(p, {}).items():
            sex = COC_CELL_MAP.get(uid, ("", ""))[1]
            if sex == "F":
                f_val += val
            elif sex == "M":
                m_val += val
        trend.append({"period": p, "label": p,
                      "female": round(f_val, 1), "male": round(m_val, 1)})

    latest_f = trend[-1]["female"] if trend else 0
    latest_m = trend[-1]["male"] if trend else 0

    return jsonify(json_safe({
        "ok": True,
        "male": latest_m,
        "female": latest_f,
        "total": latest_f + latest_m,
        "latest_period": all_periods[-1] if all_periods else "",
        "trend": trend,
    }))


# ── TX_CURR by Finer Age-Group (using age-specific DX elements) ──
@hiv_bp.get("/api/hiv-treatment/tx-curr-age-split")
def tx_curr_age_split() -> object:
    """TX_CURR by finer age groups using age-specific DX elements.
    ?county=...&subcounty=...&facility=...&period=LAST_12_MONTHS
    Returns {ok, age_data: [{age, value}], latest_period, trend}
    """
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    # Age bands come from the SHARED 30 age x sex COCs of the two TX_CURR
    # elements (Jamii + CHAP Stawisha), not from the CHAP-only indicators.
    AGE_ORDER = COC_AGE_BANDS
    TX_CURR_DX = INDICATOR_SPECS["tx_curr"]["aggregate"]

    try:
        cells = _chak_analytics_coc_cells(TX_CURR_DX, ou_id, pe)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500

    sorted_periods = sorted(cells.keys(), key=_period_sort_key)
    latest_period = sorted_periods[-1] if sorted_periods else ""

    # {age: value} for the latest period
    by_age: dict[str, float] = {a: 0.0 for a in AGE_ORDER}
    for uid, val in cells.get(latest_period, {}).items():
        band = COC_CELL_MAP.get(uid, (None, ""))[0]
        if band:
            by_age[band] = by_age.get(band, 0.0) + val

    age_data = []
    for age in AGE_ORDER:
        val = round(by_age.get(age, 0.0), 1)
        if val > 0:
            age_data.append({"age": age, "value": val})

    # Build trend (total TX_CURR across all ages)
    trend = []
    for p in sorted_periods:
        total = sum(v for uid, v in cells.get(p, {}).items()
                    if uid in COC_CELL_MAP)
        trend.append({"period": p, "label": p, "value": round(total, 1)})

    return jsonify(json_safe({
        "ok": True,
        "age_data": age_data,
        "latest_period": latest_period,
        "trend": trend,
    }))


# ── TX_NEW by Gender (Male/Female aggregate) ─────────────────────
@hiv_bp.get("/api/hiv-treatment/tx-new-gender-split")
def tx_new_gender_split() -> object:
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    # TX_NEW uses the same 30 shared age x sex COCs, so one COC-split request
    # over the Jamii "TX_NEW: Starting ART" element plus the CHAP Stawisha
    # CD4 trio (TX_New CD4<200 / >200 / unknown) covers all 259 facilities.
    TX_NEW_DX = INDICATOR_SPECS["tx_new"]["aggregate"]

    try:
        cells = _chak_analytics_coc_cells(TX_NEW_DX, ou_id, pe)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500

    all_periods = sorted(cells.keys(), key=_period_sort_key)
    trend = []
    for p in all_periods:
        f_val = m_val = 0.0
        for uid, val in cells.get(p, {}).items():
            sex = COC_CELL_MAP.get(uid, ("", ""))[1]
            if sex == "F":
                f_val += val
            elif sex == "M":
                m_val += val
        trend.append({"period": p, "label": p,
                      "female": round(f_val, 1), "male": round(m_val, 1)})

    latest_f = trend[-1]["female"] if trend else 0
    latest_m = trend[-1]["male"] if trend else 0
    return jsonify(json_safe({
        "ok": True, "male": latest_m, "female": latest_f,
        "total": latest_f + latest_m,
        "latest_period": all_periods[-1] if all_periods else "",
        "trend": trend,
    }))


# ── TX_NEW by Finer Age-Group ────────────────────────────────────
@hiv_bp.get("/api/hiv-treatment/tx-new-age-split")
def tx_new_age_split() -> object:
    county = (request.args.get("county") or "Meru County").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    # Same shared 30 age x sex COCs as TX_CURR. Zero-value bands are dropped
    # from the payload below, so keeping the full band list keeps age_data
    # summing to the same total as tx-new-gender-split.
    AGE_ORDER = list(COC_AGE_BANDS)
    TX_NEW_DX = INDICATOR_SPECS["tx_new"]["aggregate"]

    try:
        cells = _chak_analytics_coc_cells(TX_NEW_DX, ou_id, pe)
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500

    sorted_periods = sorted(cells.keys(), key=_period_sort_key)
    latest_period = sorted_periods[-1] if sorted_periods else ""
    by_age: dict[str, float] = {a: 0.0 for a in AGE_ORDER}
    for uid, val in cells.get(latest_period, {}).items():
        band = COC_CELL_MAP.get(uid, (None, ""))[0]
        if band:
            by_age[band] = by_age.get(band, 0.0) + val

    age_data = []
    for age in AGE_ORDER:
        val = round(by_age.get(age, 0.0), 1)
        if val > 0:
            age_data.append({"age": age, "value": val})
    return jsonify(json_safe({
        "ok": True, "age_data": age_data,
        "latest_period": latest_period,
    }))


# ── Homepage Summary Endpoint ─────────────────────────────────────
@hiv_bp.get("/api/homepage/summary")
def homepage_summary() -> object:
    """Consolidated DHIS2 summary for the homepage dashboard.
    Returns TX_CURR, TX_NEW, and HTS uptake data in one response.
    Params: ?county=...&subcounty=...&period=LAST_12_MONTHS
    """
    county = (request.args.get("county") or "Meru County").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()

    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    errors = []
    result = {}

    # ── DX IDs (each is the UNION of the Jamii + Stawisha namespaces) ──
    TX_NEW_DX = INDICATOR_SPECS["tx_new"]["aggregate"]    # vTTEybkXZ53 + Stawisha CD4 trio
    TX_CURR_DX = INDICATOR_SPECS["tx_curr"]["aggregate"]  # kgzd9LfXZXq + 8 regimen lines

    # HTS DXs — the two project sections, summed.  The PBIX measures
    # `HTS Tested` and `HTS Positive` are UNION(our JTP, CHAP Stawisha), so
    # pulling the halves separately keeps both attributable while the totals
    # below match the report.
    HTS_TESTED_OUR_DX = HTS_SPECS["hts_uptake"]["metrics"]["hts_tested_our"]["ids"]
    HTS_TESTED_OTHER_DX = HTS_SPECS["hts_uptake"]["metrics"]["hts_tested_other"]["ids"]
    HTS_POSITIVE_OUR_DX = HTS_SPECS["hts_uptake"]["metrics"]["hts_positive_our"]["ids"]
    HTS_POSITIVE_OTHER_DX = HTS_SPECS["hts_uptake"]["metrics"]["hts_positive_other"]["ids"]

    # ── Parallel fetch all DX groups ──
    fetch_tasks = {
        "tx_new": TX_NEW_DX,
        "tx_curr": TX_CURR_DX,
        "hts_tested_our": HTS_TESTED_OUR_DX,
        "hts_tested_other": HTS_TESTED_OTHER_DX,
        "hts_positive_our": HTS_POSITIVE_OUR_DX,
        "hts_positive_other": HTS_POSITIVE_OTHER_DX,
    }

    fetched = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {}
        for key, dx in fetch_tasks.items():
            futures[executor.submit(_dhis2_fetch, dx, ou_id, pe, None)] = key
        for future in as_completed(futures):
            key = futures[future]
            try:
                fetched[key] = future.result()
            except Exception as exc:
                errors.append(f"{key}: {exc}")
                fetched[key] = {}

    # ── Build trend ──
    all_periods = sorted(
        set().union(*[d.keys() for d in fetched.values()]),
        key=_period_sort_key,
    )

    def _label(p):
        return f"{p[:4]}-{p[4:]}" if len(str(p)) == 6 else str(p)

    tx_new_trend = []
    tx_curr_trend = []
    hts_trend = []

    for p in all_periods:
        tx_new_trend.append({
            "period": p, "label": _label(p),
            "value": round(float(fetched["tx_new"].get(p, 0)), 1),
        })
        tx_curr_trend.append({
            "period": p, "label": _label(p),
            "value": round(float(fetched["tx_curr"].get(p, 0)), 1),
        })
        tested = (float(fetched["hts_tested_our"].get(p, 0))
                  + float(fetched["hts_tested_other"].get(p, 0)))
        positive = (float(fetched["hts_positive_our"].get(p, 0))
                    + float(fetched["hts_positive_other"].get(p, 0)))
        hts_trend.append({
            "period": p, "label": _label(p),
            "tested": round(tested, 1),
            "tested_our": round(float(fetched["hts_tested_our"].get(p, 0)), 1),
            "tested_other": round(float(fetched["hts_tested_other"].get(p, 0)), 1),
            "positive": round(positive, 1),
            "positive_our": round(float(fetched["hts_positive_our"].get(p, 0)), 1),
            "positive_other": round(float(fetched["hts_positive_other"].get(p, 0)), 1),
            "positivity_rate": round((positive / tested * 100) if tested > 0 else 0, 1),
        })

    # Latest month KPIs
    latest = all_periods[-1] if all_periods else None
    kpis = {}
    if latest:
        l_tested_our = float(fetched["hts_tested_our"].get(latest, 0))
        l_tested_other = float(fetched["hts_tested_other"].get(latest, 0))
        l_pos_our = float(fetched["hts_positive_our"].get(latest, 0))
        l_pos_other = float(fetched["hts_positive_other"].get(latest, 0))
        l_tested = l_tested_our + l_tested_other
        l_positive = l_pos_our + l_pos_other
        kpis = {
            "label": _label(latest),
            "tx_curr": round(float(fetched["tx_curr"].get(latest, 0)), 1),
            "tx_new": round(float(fetched["tx_new"].get(latest, 0)), 1),
            "hts_tested": round(l_tested, 1),
            "hts_tested_our": round(l_tested_our, 1),
            "hts_tested_other": round(l_tested_other, 1),
            "hts_positive": round(l_positive, 1),
            "hts_positive_our": round(l_pos_our, 1),
            "hts_positive_other": round(l_pos_other, 1),
        }
        kpis["positivity_rate"] = round(
            (l_positive / l_tested * 100) if l_tested > 0 else 0, 1
        )

    return jsonify(json_safe({
        "source": "dhis2_live",
        "county": county,
        "subcounty": sc_filter or None,
        "ou_id": ou_id,
        "period_range": pe,
        "latest": kpis,
        "tx_new_trend": tx_new_trend,
        "tx_curr_trend": tx_curr_trend,
        "hts_trend": hts_trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "errors": errors if errors else None,
    }))


# ── Generic: Search DHIS2 Data Elements by name ──────────────────
@hiv_bp.get("/api/dhis2/search-elements")
def search_dhis2_elements() -> object:
    """Search master_data_elements.csv by name/pattern.
    Params: ?q=tx_pvls&limit=20
    Returns list of matching {id, name, displayName, shortName}
    """
    q = (request.args.get("q") or "").strip().lower()
    limit = int(request.args.get("limit", "20"))

    if not q:
        return jsonify(json_safe({"elements": [], "query": q, "total": 0}))

    dict_path = BASE_DIR.parent / "dictionaries" / "master_data_elements.csv"
    if not dict_path.exists():
        return jsonify(json_safe({"error": "Dictionary not found"})), 500

    try:
        df = pd.read_csv(dict_path)
    except Exception as exc:
        return jsonify(json_safe({"error": str(exc)})), 500

    # Search across name, displayName, shortName, id
    mask = (
        df["name"].astype(str).str.lower().str.contains(q, na=False) |
        df["displayName"].astype(str).str.lower().str.contains(q, na=False) |
        df["shortName"].astype(str).str.lower().str.contains(q, na=False) |
        df["id"].astype(str).str.lower().str.contains(q, na=False)
    )
    results = df[mask].head(limit * 3)  # grab extra for dedup
    elements = []
    seen = set()
    for _, row in results.iterrows():
        uid = str(row["id"])
        if uid in seen:
            continue
        seen.add(uid)
        elements.append({
            "id": uid,
            "name": str(row.get("name", "")),
            "displayName": str(row.get("displayName", "")),
            "shortName": str(row.get("shortName", "")),
        })
        if len(elements) >= limit:
            break

    return jsonify(json_safe({
        "elements": elements,
        "query": q,
        "total": len(elements),
    }))


# ── Generic: Query ANY data element from DHIS2 live ──────────────
@hiv_bp.get("/api/dhis2/query")
def generic_dhis2_query() -> object:
    """Query any DHIS2 data element(s) live.
    Params: ?dx=JGd3MwmKBuM&county=Meru+County
            &subcounty=...&facility=...&period=LAST_12_MONTHS
    dx can be a single UID or comma-separated list.
    Returns monthly trend data.
    """
    dx_str = (request.args.get("dx") or "").strip()
    county = (request.args.get("county") or "Meru County").strip()
    pe = (request.args.get("period") or "LAST_12_MONTHS").strip()
    sc_filter = request.args.get("subcounty", "").strip()
    fac_filter = request.args.get("facility", "").strip()

    if not dx_str:
        return jsonify(json_safe({"error": "dx parameter is required"})), 400

    dx_ids = [d.strip() for d in dx_str.split(",") if d.strip()]
    ou_id, _ = _resolve_ou_ids(county, sc_filter or None, fac_filter or None)

    raw = _dhis2_fetch(dx_ids, ou_id, pe, None)

    # Resolve names from master dictionary
    name_map = {}
    dict_path = BASE_DIR.parent / "dictionaries" / "master_data_elements.csv"
    if dict_path.exists():
        try:
            df_dict = pd.read_csv(dict_path)
            for _, r in df_dict.iterrows():
                name_map[str(r["id"])] = str(r.get("name", ""))
        except Exception:
            pass

    trend = []
    all_periods = sorted(set(raw.keys()), key=_period_sort_key)
    for p in all_periods:
        trend.append({
            "period": p,
            "label": f"{p[:4]}-{p[4:]}" if len(str(p)) == 6 else str(p),
            "value": round(float(raw.get(p, 0)), 1),
        })

    return jsonify(json_safe({
        "dx": dx_ids,
        "dx_names": {d: name_map.get(d, "") for d in dx_ids},
        "source": "dhis2_live",
        "county": county,
        "subcounty": sc_filter or None,
        "facility": fac_filter or None,
        "ou_id": ou_id,
        "period_range": pe,
        "total": round(sum(float(raw.get(p, 0)) for p in all_periods), 1),
        "trend": trend,
        "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }))
