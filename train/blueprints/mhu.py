"""MHU domain: KHIS/CHAK live data, aggregate queries, CSV merges, config."""
from __future__ import annotations

import csv
import json
from collections import OrderedDict, defaultdict

import pandas as pd
from flask import Blueprint, jsonify, request

from services.dhis2 import CHAK_BASE, CHAK_PASS, CHAK_USER, _chak_analytics_fetch
from services.khis import (
    KENYA_COUNTY_CENTERS,
    _get_facility_ward_map,
    _khis_fetch,
    _khis_fetch_disaggregated,
)
from services.paths import BASE_DIR, JAMII_TEKELEZI_FILTERS_CSV, SUPERPOWER_DIR

mhu_bp = Blueprint("mhu", __name__)

_app = None  # set by register_mhu_blueprint

# ── Module-level caches (preserved from the original monolith) ──
_CHAK_OUS_CACHE = None
_MHU_CONFIG_CACHE = None
_MHU_CSV_CACHE = None
_MHU_CSV_ROWS_CACHE = None
# Flexible name -> KHIS uid cache for the aggregate endpoint (built lazily
# across requests; keyed by lowercased facility name)
_MHU_FLEX_MATCH = {}
# Parsed index of data/mhu_khis_mapping.json: (facilities_map, name_to_id,
# flex_index).  Built once and reused by the aggregate endpoint so we never
# re-read + re-parse the 10k+ facility file per POST.
_MHU_MAPPING_INDEX = None


def _get_mhu_mapping_index():
    """Return (facilities_map, name_to_id, flex_index) for the KHIS mapping.
    facilities_map is keyed by KHIS uid -> {name, county, ...}.
    name_to_id is a lowercase-name -> uid dict (exact match).
    flex_index is the name_to_id items list for containment fallback.
    """
    global _MHU_MAPPING_INDEX
    if _MHU_MAPPING_INDEX is None:
        config_path = BASE_DIR / "data" / "mhu_khis_mapping.json"
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        facilities_map = config.get("facilities", {})
        name_to_id = {}
        for uid, finfo in facilities_map.items():
            fn = finfo.get("name", "").strip().lower()
            if fn:
                name_to_id[fn] = uid
        _MHU_MAPPING_INDEX = (facilities_map, name_to_id, list(name_to_id.items()))
    return _MHU_MAPPING_INDEX


def register_mhu_blueprint(app):
    global _app
    _app = app
    app.register_blueprint(mhu_bp)
    print("[MHU] Blueprint registered")


@mhu_bp.get("/api/khis/facility-locations")
def khis_facility_locations():
    """Return facility locations from local mapping data with county centroids.
    Uses jamii_tekelezi_filters.csv (project folder) and facility_ward_mapping.json.
    """
    cache_key = "_khis_facility_locations"
    if cache_key in _app.config:
        return jsonify({"ok": True, "facilities": _app.config[cache_key]})

    facilities = {}
    try:
        jt_path = JAMII_TEKELEZI_FILTERS_CSV
        if jt_path.exists():
            with open(jt_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    fid = row.get("facility_id", "").strip()
                    fname = row.get("facility_name", "").strip()
                    county = row.get("county_name", "").strip()
                    if fid:
                        center = KENYA_COUNTY_CENTERS.get(county, {"lat": 0.0, "lng": 38.0})
                        facilities[fid] = {
                            "name": fname,
                            "lat": center["lat"],
                            "lng": center["lng"],
                            "county": county,
                        }

        _app.config[cache_key] = facilities
        return jsonify({"ok": True, "facilities": facilities})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e), "facilities": {}})


# ── Project-to-Facility Mapping (for homepage project cards) ──────
@mhu_bp.get("/api/projects/facility-mapping")
def project_facility_mapping():
    """Return the 11 real CHAK projects with facility and MHU counts.
    MHU counts come from the confirmed per-project alignment
    (train/data/project_mhus_confirmed.json); facilities for the maps
    are resolved from KHIS locations.
    """
    projects = {
        "jamii_tekelezi": {
            "name": "Jamii Tekelezi (JTP)",
            "icon": "🩺",
            "description": "Comprehensive HIV/AIDS program — Testing, Treatment, PrEP, PMTCT, TB.",
        },
        "chap_stawisha": {
            "name": "CHAP Stawisha",
            "icon": "🌱",
            "description": "Community Health and Adolescent Program — HIV care, FHTS, PrEP, TB, Lab.",
        },
        "eis": {
            "name": "EIS",
            "icon": "🔬",
            "description": "EIS — Evaluation of Integrated Services.",
        },
        "gf_mnch": {
            "name": "Gates Foundation MNCH",
            "icon": "💉",
            "description": "Gates Foundation — Maternal, Newborn & Child Health (MNCH).",
        },
        "bftw_rmncah": {
            "name": "BFTW RMNCAH",
            "icon": "🤝",
            "description": "Bread for the World RMNCAH — universal access to RMNCAH & nutrition services.",
        },
        "pep": {
            "name": "PEP",
            "icon": "💊",
            "description": "PEP — Partnership for Education and Health Professionals.",
        },
        "impact": {
            "name": "IMPACT Project",
            "icon": "🎯",
            "description": "Improving Pharmaceutical Access Through Continuous Training (IMPACT).",
        },
        "eye_health": {
            "name": "Eye Health (ACSP)",
            "icon": "👁️",
            "description": "Eye Health (ACSP) — Africa Clear Sight Partnership presbyopia program.",
        },
        "cdic_icare": {
            "name": "CDIC / iCARE",
            "icon": "💻",
            "description": "CDIC / iCARE — Community Data Integration for Care and Response Evaluation.",
        },
        "internship": {
            "name": "Internship Program",
            "icon": "🧑‍⚕️",
            "description": "Internship Program — training and professional development placements.",
        },
        "gitlab": {
            "name": "GitLab",
            "icon": "🔭",
            "description": "GitLab — monthly reporting and monitoring.",
        },
    }

    # ── Load confirmed per-project MHU counts (MFL code based) ──
    confirmed = {}
    try:
        confirmed_path = BASE_DIR / "data" / "project_mhus_confirmed.json"
        if confirmed_path.exists():
            with open(confirmed_path, "r", encoding="utf-8") as f:
                confirmed = json.load(f).get("projects", {})
    except Exception:
        pass

    # ── Resolve facilities + counties for maps ──
    facility_locations = _app.config.get("_khis_facility_locations", {})
    result = {}
    for proj_id, proj_info in projects.items():
        conf = confirmed.get(proj_id, {})
        fac_list = conf.get("facilities", [])
        # facility_count is the deduplicated count (unique MFL codes)
        mhu_count = conf.get("facility_count", 0) or len(fac_list)
        # Dedupe by MFL code first so county counts, the visible MHU list
        # and the map all agree with the card number (a facility can appear
        # in multiple datasets, sometimes with a conflicting county).
        seen_mfl = set()
        unique_fac = []
        for f in fac_list:
            mfl = str(f.get("mfl", "")).strip()
            if not mfl or mfl in seen_mfl:
                continue
            seen_mfl.add(mfl)
            unique_fac.append(f)
        counties = sorted(
            {f.get("county", "") for f in unique_fac if f.get("county")}
        )

        # Build KHIS facility markers by county (fallback visual)
        matched_facilities = {}
        if counties:
            cset = {c.lower().strip() for c in counties}
            for fid, finfo in facility_locations.items():
                fcounty = (finfo.get("county", "") or "").lower().strip()
                if fcounty in cset:
                    matched_facilities[fid] = finfo
        if not matched_facilities:
            # Fallback: county-centre markers for visual
            for i, county in enumerate(counties or ["Kenya"]):
                center = KENYA_COUNTY_CENTERS.get(
                    county, {"lat": 0.5, "lng": 38.0}
                )
                matched_facilities[f"__{proj_id}_{i}"] = {
                    "name": f"{county} Office",
                    "lat": center["lat"],
                    "lng": center["lng"],
                    "county": county,
                }

        result[proj_id] = {
            **proj_info,
            "facility_count": len(matched_facilities),
            "facilities": matched_facilities,
            "mhu_count": mhu_count,
            "counties": counties,
            "mhu_list": unique_fac,
        }

    # ── Full confirmed MHU list (586 rows) for the "All MHUs" hero card ──
    all_mhus = []
    try:
        master_path = BASE_DIR / "data" / "chak_mhus_master.json"
        if master_path.exists():
            with open(master_path, "r", encoding="utf-8") as f:
                all_mhus = json.load(f).get("rows", [])
    except Exception:
        pass

    return jsonify(
        {
            "ok": True,
            "projects": result,
            "all_mhu_count": len(all_mhus),
            "all_mhus": all_mhus,
        }
    )


@mhu_bp.get("/api/projects/mhus")
def project_mhu_list():
    """Return the MHU list for one project (or 'all' for the full 586).
    Query param: ?project=<home slug or 'all'>
    """
    project_id = request.args.get("project", "all").strip()
    if project_id == "all":
        master_path = BASE_DIR / "data" / "chak_mhus_master.json"
        try:
            with open(master_path, "r", encoding="utf-8") as f:
                rows = json.load(f).get("rows", [])
        except Exception:
            rows = []
        return jsonify(
            {
                "ok": True,
                "project": "all",
                "name": "All CHAK MHUs",
                "count": len(rows),
                "rows": rows,
            }
        )

    confirmed_path = BASE_DIR / "data" / "project_mhus_confirmed.json"
    try:
        with open(confirmed_path, "r", encoding="utf-8") as f:
            confirmed = json.load(f).get("projects", {})
    except Exception:
        confirmed = {}
    conf = confirmed.get(project_id, {})
    rows = conf.get("facilities", [])
    # The facilities list can contain the same MFL code multiple times
    # (a facility appears in several datasets). Dedupe by MFL code so the
    # visible list matches the card's MHU count.
    seen = set()
    unique_rows = []
    for r in rows:
        mfl = str(r.get("mfl", "")).strip()
        if not mfl or mfl in seen:
            continue
        seen.add(mfl)
        unique_rows.append(r)
    return jsonify(
        {
            "ok": True,
            "project": project_id,
            "name": conf.get("name") or project_id,
            "count": len(unique_rows),
            "rows": unique_rows,
        }
    )


@mhu_bp.get("/api/kenya-counties")
def kenya_counties_geojson():
    """Serve Kenya county boundaries as GeoJSON for choropleth maps."""
    geojson_path = BASE_DIR / "data" / "kenya_counties.geojson"
    if not geojson_path.exists():
        return jsonify({"error": "County boundary file not found"}), 404
    try:
        with open(geojson_path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── MHU endpoint (KHIS-sourced) ──────────────────────────────────
@mhu_bp.get("/api/mhu/khis-data")
def mhu_khis_data():
    """Query KHIS DHIS2 analytics for MHU indicators.
    Params: ?dx=...&ou=...&pe=LAST_MONTH&resolve_ward=false
    When resolve_ward=true, resolves facility OU to its LEVEL-4 (ward) parent.
    """
    dx = request.args.get("dx", "")
    ou = request.args.get("ou", "")
    pe = request.args.get("pe", "LAST_MONTH")
    resolve_ward = request.args.get("resolve_ward", "false").lower() == "true"
    if not dx or not ou:
        return jsonify({"error": "Both 'dx' and 'ou' parameters are required"}), 400
    try:
        actual_ou = ou
        ward_info = None
        if resolve_ward:
            ward_map = _get_facility_ward_map()
            entry = ward_map.get(ou)
            if entry:
                actual_ou = entry["ward_id"]
                ward_info = {
                    "ward_id": entry["ward_id"],
                    "ward_name": entry["ward_name"],
                    "facility_name": entry["facility_name"],
                }
                # Try LAST_MONTH first (fast), fall back to broader periods
                result = _khis_fetch(dx, actual_ou, "LAST_MONTH", None)
                if not result or all(len(v) == 0 for v in result.values()):
                    result = _khis_fetch(dx, actual_ou, "LAST_3_MONTHS", None)
                if not result or all(len(v) == 0 for v in result.values()):
                    result = _khis_fetch(dx, actual_ou, "2025", None)
                if not result or all(len(v) == 0 for v in result.values()):
                    result = _khis_fetch(dx, actual_ou, "LAST_5_YEARS", None)
                return jsonify({
                    "source": "khis_live",
                    "data": result,
                    "ward": ward_info,
                    "resolved_ou": actual_ou,
                })
            # If facility not in ward map, fall through to default query

        result = _khis_fetch(dx, actual_ou, pe, None)
        return jsonify({"source": "khis_live", "data": result, "ward": ward_info})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── MHU COC-disaggregated endpoint ──────────────────────────────
@mhu_bp.get("/api/mhu/khis-data-coc")
def mhu_khis_data_coc():
    """Query KHIS analytics with CO dimension for COC-level breakdown.
    Params: ?dx=...&co=COC1;COC2&ou=...&pe=LAST_MONTH
    Returns: {"data": {"DE_ID.CO_ID": {period: value, ...}, ...}}
    """
    dx = request.args.get("dx", "")
    co = request.args.get("co", "")
    ou = request.args.get("ou", "")
    pe = request.args.get("pe", "LAST_MONTH")
    if not dx or not ou or not co:
        return jsonify({"error": "Parameters 'dx', 'co', and 'ou' are required"}), 400
    try:
        result = _khis_fetch_disaggregated(dx, ou, co, pe)
        return jsonify({"source": "khis_live", "data": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── MHU aggregate endpoint (across multiple facilities) ──────────
@mhu_bp.post("/api/mhu/khis-data-aggregate")
def mhu_khis_data_aggregate():
    """Aggregate KHIS data across multiple facilities.
    POST JSON body: {dx: "...", names: ["Fac1", "Fac2", ...], pe: "LAST_MONTH"}
    Looks up KHIS IDs from the mapping config by facility name.
    Batches requests (max ~300 OUs each) to avoid KHIS URL length limits.
    """
    global _MHU_FLEX_MATCH
    body = request.get_json(silent=True) or {}
    dx = body.get("dx", "")
    names = body.get("names", [])
    pe = body.get("pe", "LAST_MONTH")
    if not dx or not names or not isinstance(names, list):
        return jsonify({"error": "Body must include 'dx' (string) and 'names' (array)"}), 400
    try:
        # Load the pre-built name -> KHIS ID index (cached module-level so
        # the 10k+ facility mapping file is parsed only once per process).
        facilities_map, name_to_id, flex_index = _get_mhu_mapping_index()

        # Match requested names to KHIS IDs — exact first, then flexible
        # containment (same logic as the single-facility view) so CHAK
        # names like "ACK Kathangariri Dispensary" match KHIS
        # "Kathangariri Dispensary". Results are cached across requests
        # (facility set is static) so repeated loads are fast.
        matched_ids = []
        matched_names = []
        for name in names:
            key = name.lower().strip()
            uid = name_to_id.get(key)
            if not uid:
                uid = _MHU_FLEX_MATCH.get(key)
            if not uid:
                for fn, cand_uid in flex_index:
                    if key in fn or fn in key:
                        uid = cand_uid
                        _MHU_FLEX_MATCH[key] = uid
                        break
            if uid:
                matched_ids.append(uid)
                matched_names.append(name)

        if not matched_ids:
            return jsonify({
                "source": "khis_aggregate",
                "data": {},
                "matched_count": 0,
                "total_requested": len(names),
                "note": "No facilities could be matched to KHIS IDs",
            })

        # Batch query KHIS - max 300 OUs per request to avoid URL limits
        BATCH_SIZE = 300
        merged = {}
        for i in range(0, len(matched_ids), BATCH_SIZE):
            batch_ids = matched_ids[i:i + BATCH_SIZE]
            ou_str = ";".join(batch_ids)
            result = _khis_fetch(dx, ou_str, pe, None)
            if not result or all(len(v) == 0 for v in result.values()):
                result = _khis_fetch(dx, ou_str, "LAST_3_MONTHS", None)
            if not result or all(len(v) == 0 for v in result.values()):
                result = _khis_fetch(dx, ou_str, "2025", None)
            # Merge batch results
            for de_id, period_data in result.items():
                if de_id not in merged:
                    merged[de_id] = {}
                for period, val in period_data.items():
                    merged[de_id][period] = merged[de_id].get(period, 0) + val

        return jsonify({
            "source": "khis_aggregate",
            "data": merged,
            "matched_count": len(matched_ids),
            "total_requested": len(names),
            "matched_names": matched_names[:5],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Key Indicators Drill down CSV ───────────────────────────────────
@mhu_bp.get("/api/key-indicators")
def key_indicators():
    """Serve the Key Indicators Drill down.csv as JSON."""
    csv_path = SUPERPOWER_DIR / "Key Indicators Drill down.csv"
    if not csv_path.exists():
        return jsonify({"error": "Key Indicators file not found"}), 404
    try:
        df = pd.read_csv(csv_path)
        df = df.fillna("")
        # Clean percentage columns — strip % and convert to numeric
        pct_cols = ["Linkage", "% VL Uptake", "% VL Suppression", "%IIT", "CD4 Uptake", "TPT Uptake"]
        for col in pct_cols:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace("%", "", regex=False).str.strip()
                df[col] = pd.to_numeric(df[col], errors="coerce")
        count_cols = ["HTS Positive", "TX_NEW", "TX_NEW CD4", "TPT"]
        for col in count_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        # Convert to list of dicts with native Python types
        records = df.to_dict(orient="records")
        for r in records:
            for k, v in r.items():
                if isinstance(v, float):
                    if pd.isna(v):
                        r[k] = None
        # Compute summary aggregates
        summary = {}
        numeric_cols = ["HTS Positive", "Linkage", "% VL Uptake", "% VL Suppression",
                       "%IIT", "TX_NEW", "TX_NEW CD4", "CD4 Uptake", "TPT", "TPT Uptake"]
        for col in numeric_cols:
            vals = df[col]
            valid = vals.dropna()
            summary[col] = {
                "total": int(valid.sum()) if col in count_cols and len(valid) > 0 else None,
                "avg": round(float(valid.mean()), 1) if len(valid) > 0 else 0,
                "min": round(float(valid.min()), 1) if len(valid) > 0 else 0,
                "max": round(float(valid.max()), 1) if len(valid) > 0 else 0,
            }
        return jsonify({
            "rows": records,
            "count": len(records),
            "summary": summary,
            "columns": list(df.columns),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mhu_bp.get("/api/mhu/chak-data")
def mhu_chak_data():
    """Query CHAK DHIS2 analytics for MOH 740 / MOH 731 indicators.
    Params: ?dx=...&ou=...&pe=LAST_12_MONTHS
    """
    dx = request.args.get("dx", "")
    ou = request.args.get("ou", "")
    pe = request.args.get("pe", "LAST_12_MONTHS")
    if not dx or not ou:
        return jsonify({"error": "Both 'dx' and 'ou' parameters are required"}), 400
    try:
        result = _chak_analytics_fetch(dx, ou, pe)
        return jsonify({"source": "chak_live", "data": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── CHAK org unit lookup by name ──────────────────────────────────
@mhu_bp.get("/api/mhu/chak-ou-lookup")
def mhu_chak_ou_lookup():
    """Look up CHAK org unit ID by facility name.
    Params: ?name=...  Returns {uid, name} or null.
    """
    global _CHAK_OUS_CACHE
    name = request.args.get("name", "").strip().lower()
    if not name:
        return jsonify({"error": "name parameter required"}), 400

    if _CHAK_OUS_CACHE is None:
        _CHAK_OUS_CACHE = []
        # Load from all_chak_facilities.csv (PBIX export)
        csv_path = BASE_DIR.parent / "CHAK_Visuals_4_explore" / "all_chak_facilities.csv"
        if csv_path.exists():
            with open(csv_path, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    _CHAK_OUS_CACHE.append({
                        "uid": row["UID"],
                        "name": row["Name"].strip().lower(),
                    })
        # Also load from CHAK MHUs.csv (official CHAK member list)
        chak_mhu_path = BASE_DIR.parent / "CHAK MHUs.csv"
        if chak_mhu_path.exists():
            seen_ids = set(x["uid"] for x in _CHAK_OUS_CACHE)
            with open(chak_mhu_path, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    uid = row.get("organisationunitid", "").strip()
                    name = row.get("organisationunitname", "").strip().lower()
                    if uid and name and uid not in seen_ids:
                        _CHAK_OUS_CACHE.append({"uid": uid, "name": name})
                        seen_ids.add(uid)

    # Try exact match first, then contains
    exact = [x for x in _CHAK_OUS_CACHE if x["name"] == name]
    if exact:
        return jsonify({"uid": exact[0]["uid"], "name": exact[0]["name"]})

    partial = [x for x in _CHAK_OUS_CACHE if name in x["name"] or x["name"] in name]
    if partial:
        return jsonify({"uid": partial[0]["uid"], "name": partial[0]["name"]})
    return jsonify(None)


# ── MHU config endpoint (serves mapping JSON) ──────────────────────
@mhu_bp.get("/api/mhu/config")
def mhu_config():
    """Return the MHU KHIS mapping configuration (facilities, ownership, tabs)."""
    global _MHU_CONFIG_CACHE
    if _MHU_CONFIG_CACHE is not None:
        return jsonify(_MHU_CONFIG_CACHE)
    mapping_path = BASE_DIR / "data" / "mhu_khis_mapping.json"
    if not mapping_path.exists():
        return jsonify({"error": "Mapping file not found"}), 404
    try:
        with open(mapping_path, "r", encoding="utf-8") as f:
            _MHU_CONFIG_CACHE = json.load(f)
        return jsonify(_MHU_CONFIG_CACHE)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── MHU CSV data endpoint (from PBIX exports: data.csv + data2.csv) ──
@mhu_bp.get("/api/mhu/csv-data")
def mhu_csv_data():
    """Return merged facilities from data.csv and data2.csv for cascading filters."""
    global _MHU_CSV_CACHE, _MHU_CSV_ROWS_CACHE
    if _MHU_CSV_CACHE is not None:
        return jsonify(_MHU_CSV_CACHE)

    csv_paths = [
        BASE_DIR.parent / "data.csv",
        BASE_DIR.parent / "data2.csv",
    ]

    try:
        facilities = OrderedDict()  # keyed by facility name
        county_owner_map = {}  # county -> set of owner types
        ot_owner_map = {}  # owner type -> set of owners
        all_rows = []  # all data rows for per-facility queries

        for csv_path in csv_paths:
            if not csv_path.exists():
                continue
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    name = row["Name"].strip()
                    county = row["County"].strip()
                    owner_type = row["Owner type"].strip()
                    owner = row["Owner"].strip()
                    service = row["Service Type"].strip()
                    year = row["Year"].strip()
                    value = float(row["Sum of Value"])

                    # Only store each facility once (first occurrence wins)
                    if name not in facilities:
                        facilities[name] = {
                            "name": name,
                            "county": county,
                            "owner_type": owner_type,
                            "owner": owner,
                        }

                    # Build filter hierarchies
                    if county not in county_owner_map:
                        county_owner_map[county] = set()
                    county_owner_map[county].add(owner_type)

                    if owner_type not in ot_owner_map:
                        ot_owner_map[owner_type] = {}
                    ot_owner_map[owner_type][owner] = True

                    # Store row for per-facility queries
                    all_rows.append({
                        "name": name,
                        "county": county,
                        "owner_type": owner_type,
                        "owner": owner,
                        "service_type": service,
                        "year": year,
                        "value": value,
                    })

        # ── Strip out old PBIX CHAK facilities, replace with facilities_report ──
        # Remove any facility previously assigned as "Christian Health Association of Kenya"
        # so only the new facilities_report list appears for that owner
        chak_facility_names = {name for name, f in facilities.items()
                               if f["owner"] == "Christian Health Association of Kenya"}
        for name in chak_facility_names:
            del facilities[name]

        # ── First, load old CHAK MHUs.csv to build name→chak_ou_id lookup (for HIV routing) ──
        chak_ou_lookup = {}
        chak_mhu_path = BASE_DIR.parent / "CHAK MHUs.csv"
        if chak_mhu_path.exists():
            with open(chak_mhu_path, "r", encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    name = row.get("organisationunitname", "").strip()
                    ou_id = row.get("organisationunitid", "").strip()
                    if name and ou_id:
                        chak_ou_lookup[name] = ou_id

        # ── Merge facilities_report_2026-07-09 (1).csv (CHAK-supported facilities, 591 facilities) ──
        chak_new_path = BASE_DIR.parent / "facilities_report_2026-07-09 (1).csv"
        if chak_new_path.exists():
            with open(chak_new_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                seen_names = set()
                for row in reader:
                    name = row.get("Facility Name", "").strip()
                    county = row.get("County", "").strip()
                    if not name or not county:
                        continue
                    # Normalize county to Title Case (e.g. "MURANG'A" -> "Murang'a")
                    county = county.title()
                    # Disambiguate duplicates: "Ndumari Dispensary" -> "Ndumari Dispensary (Tharaka Nithi)"
                    if name in seen_names:
                        orig_name = name
                        name = f"{name} ({county})"
                    else:
                        seen_names.add(name)
                        orig_name = name
                    # Look up chak_ou_id: try exact name first, then original (pre-disambiguation) name
                    chak_ou_id = chak_ou_lookup.get(name, "") or chak_ou_lookup.get(orig_name, "")
                    if name not in facilities:
                        facilities[name] = {
                            "name": name,
                            "county": county,
                            "owner_type": "Faith Based Organization",
                            "owner": "Christian Health Association of Kenya",
                            "chak_ou_id": chak_ou_id,
                        }
                    else:
                        # Overwrite existing facility's owner to CHAK
                        facilities[name]["owner_type"] = "Faith Based Organization"
                        facilities[name]["owner"] = "Christian Health Association of Kenya"
                        facilities[name]["county"] = county
                        facilities[name]["chak_ou_id"] = chak_ou_id
                    # Ensure county -> owner_type mapping includes FBO
                    if county not in county_owner_map:
                        county_owner_map[county] = set()
                    county_owner_map[county].add("Faith Based Organization")
                    if "Faith Based Organization" not in ot_owner_map:
                        ot_owner_map["Faith Based Organization"] = {}
                    ot_owner_map["Faith Based Organization"]["Christian Health Association of Kenya"] = True

        # ── Merge KHIS mapping facilities for counties NOT in CSV ──
        OWNERSHIP_MAP = {
            "Revised Ministry of Health (2018)": ("Ministry of Health", "Ministry of Health"),
            "Revised Faith Based Organisation (2018)": ("Faith Based Organization", "Christian Health Association of Kenya"),
            "Revised Private(2018)": ("Private Practice", "Private Practice - General Practitioner"),
            "UNCLASSIFIED": ("Unclassified", "Unclassified"),
        }
        try:
            mapping_path = BASE_DIR / "data" / "mhu_khis_mapping.json"
            if mapping_path.exists():
                mapping = json.loads(mapping_path.read_text(encoding="utf-8"))
                csv_counties = set(f["county"] for f in facilities.values())
                for uid, minfo in mapping.get("facilities", {}).items():
                    county = minfo["county"]
                    if county in csv_counties:
                        continue  # already covered by CSV
                    name = minfo["name"]
                    ownership = minfo.get("ownership", "")
                    owner_type, owner = OWNERSHIP_MAP.get(ownership, ("Unknown", "Unknown"))
                    # Skip CHAK facilities from KHIS mapping — only CHAK MHUs.csv defines them
                    if owner == "Christian Health Association of Kenya":
                        continue
                    if name not in facilities:
                        facilities[name] = {
                            "name": name,
                            "county": county,
                            "owner_type": owner_type,
                            "owner": owner,
                        }
                    if county not in county_owner_map:
                        county_owner_map[county] = set()
                    county_owner_map[county].add(owner_type)
                    if owner_type not in ot_owner_map:
                        ot_owner_map[owner_type] = {}
                    ot_owner_map[owner_type][owner] = True
        except Exception:
            pass  # mapping merge is best-effort

        # ── Rebuild filter maps from actual facilities dict ──
        # This ensures only owners that actually have facilities appear in filters
        # (critical after stripping CSV Christian Health Association of Kenya facilities)
        county_owner_map = {}
        ot_owner_map = {}
        for f in facilities.values():
            co = f["county"]
            ot = f["owner_type"]
            ow = f["owner"]
            if co not in county_owner_map:
                county_owner_map[co] = set()
            county_owner_map[co].add(ot)
            if ot not in ot_owner_map:
                ot_owner_map[ot] = {}
            ot_owner_map[ot][ow] = True

        # Build cascading filter structure
        counties = {}
        for county, ots in sorted(county_owner_map.items()):
            owner_type_list = []
            # First, collect which owners actually exist in this county
            county_owners = {}  # ot -> set of owners
            for f in facilities.values():
                if f["county"] == county:
                    if f["owner_type"] not in county_owners:
                        county_owners[f["owner_type"]] = set()
                    county_owners[f["owner_type"]].add(f["owner"])
            for ot in sorted(ots):
                owners_in_ot = sorted(county_owners.get(ot, []))
                owner_type_list.append({
                    "type": ot,
                    "owners": owners_in_ot,
                })
            fac_count = sum(1 for f in facilities.values() if f["county"] == county)
            counties[county] = {
                "facility_count": fac_count,
                "owner_types": owner_type_list,
            }

        # Build owner_type -> owners globally
        owner_types = {}
        for ot, owners_map in sorted(ot_owner_map.items()):
            owner_types[ot] = sorted(owners_map.keys())

        result = {
            "facilities": list(facilities.values()),
            "total_facilities": len(facilities),
            "counties": counties,
            "owner_types": owner_types,
        }

        _MHU_CSV_CACHE = result
        _MHU_CSV_ROWS_CACHE = all_rows
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mhu_bp.get("/api/mhu/csv-facility-data")
def mhu_csv_facility_data():
    """Return all CSV rows for a specific facility name."""
    global _MHU_CSV_ROWS_CACHE
    facility_name = request.args.get("name", "").strip()
    if not facility_name:
        return jsonify({"error": "name parameter required"}), 400

    # Ensure cache is loaded
    if _MHU_CSV_ROWS_CACHE is None:
        mhu_csv_data()

    rows = [r for r in (_MHU_CSV_ROWS_CACHE or []) if r["name"] == facility_name]
    if not rows:
        return jsonify({"rows": [], "total": 0})

    # Pivot: group by service_type -> {year: value}
    pivot = defaultdict(dict)
    years_set = set()
    services_set = set()
    for r in rows:
        pivot[r["service_type"]][r["year"]] = r["value"]
        years_set.add(r["year"])
        services_set.add(r["service_type"])

    result = {
        "rows": rows,
        "total": len(rows),
        "years": sorted(years_set),
        "services": sorted(services_set),
        "pivot": {svc: dict(yrs) for svc, yrs in pivot.items()},
    }
    return jsonify(result)


# ── CHAK DHIS program indicators discovery ──────────────────────
@mhu_bp.get("/api/mhu/chak-program-indicators")
def mhu_chak_program_indicators():
    """Query CHAK DHIS2 for HIV-related program indicators.
    Params: ?search=HIV (default) to search by name
    """
    import requests as _req
    from requests.auth import HTTPBasicAuth

    search = request.args.get("search", "HIV")
    auth = HTTPBasicAuth(CHAK_USER, CHAK_PASS)

    # First: search program indicators
    pi_url = CHAK_BASE.rstrip("/") + "/programIndicators.json"
    pi_params = {
        "filter": f"name:ilike:{search}",
        "fields": "id,name,program[id,name],shortName",
        "paging": "false",
    }
    pi_result = {"count": 0, "indicators": []}
    try:
        resp = _req.get(pi_url, params=pi_params, auth=auth, verify=False, timeout=60)
        if resp.ok:
            data = resp.json()
            pis = data.get("programIndicators", [])
            pi_result["count"] = len(pis)
            pi_result["indicators"] = [{
                "id": p["id"],
                "name": p.get("name", ""),
                "shortName": p.get("shortName", ""),
                "program": p.get("program", {}),
            } for p in pis]
    except Exception as e:
        pi_result["error"] = str(e)

    # Also: search data elements (in case program indicators not used)
    de_url = CHAK_BASE.rstrip("/") + "/dataElements.json"
    de_params = {
        "filter": f"name:ilike:{search}",
        "fields": "id,name,shortName",
        "paging": "false",
    }
    de_result = {"count": 0, "elements": []}
    try:
        resp = _req.get(de_url, params=de_params, auth=auth, verify=False, timeout=60)
        if resp.ok:
            data = resp.json()
            des = data.get("dataElements", [])
            de_result["count"] = len(des)
            de_result["elements"] = [{
                "id": d["id"],
                "name": d.get("name", ""),
                "shortName": d.get("shortName", ""),
            } for d in des]
    except Exception as e:
        de_result["error"] = str(e)

    # Also: list HIV programs
    prog_url = CHAK_BASE.rstrip("/") + "/programs.json"
    prog_params = {
        "filter": f"name:ilike:{search}",
        "fields": "id,name,shortName",
        "paging": "false",
    }
    prog_result = {"count": 0, "programs": []}
    try:
        resp = _req.get(prog_url, params=prog_params, auth=auth, verify=False, timeout=60)
        if resp.ok:
            data = resp.json()
            progs = data.get("programs", [])
            prog_result["count"] = len(progs)
            prog_result["programs"] = [{
                "id": p["id"],
                "name": p.get("name", ""),
                "shortName": p.get("shortName", ""),
            } for p in progs]
    except Exception as e:
        prog_result["error"] = str(e)

    return jsonify({
        "search_term": search,
        "program_indicators": pi_result,
        "data_elements": de_result,
        "programs": prog_result,
    })
