"""Jamii Tekelezi domain: filter locations + TX_NEW CSV endpoints."""
from __future__ import annotations

import pandas as pd
from flask import Blueprint, jsonify, request

from services.common import json_safe
from services.paths import BASE_DIR

jt_bp = Blueprint("jt", __name__)

_app = None  # set by register_jt_blueprint


def register_jt_blueprint(app):
    global _app
    _app = app
    app.register_blueprint(jt_bp)
    print("[JT] Blueprint registered")


@jt_bp.get("/api/jamii-tekelezi/locations")
def jamii_tekelezi_locations() -> object:
    """Return JT counties, sub-counties, and full facility hierarchy for global filters."""
    jt_path = BASE_DIR / "data" / "jamii_tekelezi_filters.csv"
    if not jt_path.exists():
        return jsonify({"counties": [], "subcounties": [], "county_subcounties": {}, "facility_names": [], "facility_ids": [], "facility_id_name_map": {}, "facilities_by_subcounty": {}})
    try:
        jt_df = pd.read_csv(jt_path)
        counties = sorted(jt_df["county_name"].dropna().unique().tolist())
        subcounties = sorted(jt_df["subcounty_name"].dropna().unique().tolist())

        # Build facility ID ↔ name mapping
        id_name_records = jt_df[["facility_id", "facility_name"]].dropna().drop_duplicates()
        facility_id_name_map = dict(zip(id_name_records["facility_id"], id_name_records["facility_name"]))
        facility_names = sorted(id_name_records["facility_name"].unique().tolist())
        facility_ids = sorted(id_name_records["facility_id"].unique().tolist())

        # Build county → sub-counties mapping
        county_subcounties = {}
        for county in counties:
            subs = sorted(jt_df.loc[jt_df["county_name"] == county, "subcounty_name"].dropna().unique().tolist())
            county_subcounties[county] = subs

        # Build county → subcounty → [facility_id, facility_name] hierarchy
        facilities_by_subcounty = {}
        for _, row in jt_df.iterrows():
            c = row["county_name"]
            sc = row["subcounty_name"]
            fid = row["facility_id"]
            fname = row["facility_name"]
            if not (c and sc and fid):
                continue
            key = f"{c}||{sc}"
            if key not in facilities_by_subcounty:
                facilities_by_subcounty[key] = []
            facilities_by_subcounty[key].append({"id": fid, "name": fname})

        return jsonify({
            "counties": counties,
            "subcounties": subcounties,
            "county_subcounties": county_subcounties,
            "facility_names": facility_names,
            "facility_ids": facility_ids,
            "facility_id_name_map": facility_id_name_map,
            "facilities_by_subcounty": facilities_by_subcounty,
        })
    except Exception as e:
        return jsonify({"error": str(e), "counties": [], "subcounties": [], "county_subcounties": {}, "facility_names": [], "facility_ids": [], "facility_id_name_map": {}, "facilities_by_subcounty": {}})


@jt_bp.get("/api/hiv-treatment/newly-started-art/by-county")
def newly_started_art_by_county() -> object:
    """Return TX_NEW data for Jamii Tekelezi counties (Meru, Embu, Nyandarua, Tharaka Nithi).
    Reads the raw DHIS analytics CSV, maps wards to counties, filters to JT counties only.
    Also returns subcounty & facility filter data from the consolidated filters CSV.
    Supports ?month=YYYYMM filter.
    """
    try:
        # Load Jamii Tekelezi filter definitions
        jt_path = BASE_DIR / "data" / "jamii_tekelezi_filters.csv"
        if not jt_path.exists():
            return jsonify(json_safe({"error": "Jamii Tekelezi filters not found."})), 404
        jt_df = pd.read_csv(jt_path)
        jt_counties = sorted(jt_df["county_name"].unique())
        # Build subcounty list per county
        sc_by_county = {}
        for _, row in jt_df.iterrows():
            cn = row["county_name"]
            sn = row["subcounty_name"]
            if cn not in sc_by_county:
                sc_by_county[cn] = set()
            sc_by_county[cn].add(sn)
        jt_subcounties = {c: sorted(v) for c, v in sc_by_county.items()}
        # Build facility list per subcounty
        fac_by_sc = {}
        for _, row in jt_df.iterrows():
            cn = row["county_name"]
            sn = row["subcounty_name"]
            fn = row["facility_name"]
            key = f"{cn}||{sn}"
            if key not in fac_by_sc:
                fac_by_sc[key] = set()
            fac_by_sc[key].add(fn)
        jt_facilities = {k: sorted(v) for k, v in fac_by_sc.items()}

        # Load raw TX_NEW data
        raw_path = BASE_DIR / "data" / "dhis" / "raw" / "hiv_newly_started_art.csv"
        if not raw_path.exists():
            return jsonify(json_safe({"error": "Raw data not found."})), 404

        # Load org units for county mapping
        ou_path = BASE_DIR / "data" / "dhis" / "meta" / "organisation_units.csv"
        ou_df = pd.read_csv(ou_path)
        ou_name = dict(zip(ou_df["id"].astype(str), ou_df["name"]))
        ou_path_map = dict(zip(ou_df["id"].astype(str), ou_df["path"].astype(str)))

        # Load raw data and filter for TX_NEW
        df = pd.read_csv(raw_path)
        tx_new = df[df["dx"] == "gv7bbGesTTJ"].copy()

        # Map each ward to its county (level 2 in path)
        def get_county(oid: str) -> str:
            p = ou_path_map.get(oid, "")
            parts = p.split("/")
            if len(parts) >= 3:
                return ou_name.get(parts[2], parts[2])
            return "Unknown"

        tx_new["county"] = tx_new["ou"].map(get_county)

        # Filter to JT counties only
        tx_new = tx_new[tx_new["county"].isin(jt_counties)]

        # Aggregate by county and month
        grouped = (
            tx_new.groupby(["county", "pe"], as_index=False)["value"]
            .sum()
            .rename(columns={"pe": "period", "value": "total"})
            .sort_values(["period", "county"])
        )

        # Format period label
        grouped["period_label"] = grouped["period"].apply(
            lambda p: f"{str(p)[:4]}-{str(p)[4:]}" if len(str(p)) == 6 else str(p)
        )

        # Build available months list (sorted newest first)
        months_list = sorted(tx_new["pe"].unique(), reverse=True)
        months = [
            {"period": str(m), "label": f"{str(m)[:4]}-{str(m)[4:]}"}
            for m in months_list
        ]

        # Optional month filter
        month_filter = request.args.get("month", "")
        if month_filter:
            grouped = grouped[grouped["period"] == month_filter]

        return jsonify(json_safe({
            "rows": grouped.to_dict(orient="records"),
            "months": months,
            "all_counties": jt_counties,
            "default_counties": jt_counties,  # all JT counties shown by default
            "default_month": str(months_list[0]) if months_list else "",
            "subcounties": jt_subcounties,
            "facilities": jt_facilities,
        }))
    except Exception as exc:
        return jsonify(json_safe({"error": str(exc)})), 500


@jt_bp.get("/api/hiv-treatment/nart-trend")
def nart_trend() -> object:
    """Return monthly trend for three NART metrics (Total, Males, Adults 15+)
    for a given Jamii Tekelezi county (default Meru County).
    """
    county_filter = (request.args.get("county") or "Meru County").strip()

    # ── Male Tx_New STA IDs (all age groups) ──
    MALE_DX = {
        "rpL7wMYNPDH", "s9iBEnfSHhh", "JprDjnAyB0f", "PG5Ynz9xGCu",
        "SNOcc1Tq2iH", "VqYNMLji5U5", "wJWCrZVh1iu", "jjXJNig8fxs",
        "Lbs5RUpnwPD", "cQrYHDWkY2y", "QRV2YRNGYJ6", "Mt9G8jCODUw",
        "FDRjPKGGVC9", "ShO7o3bHsNr", "ivLPgJtKgcN",
    }
    # ── Adults 15+ Tx_New STA IDs (both sexes) ──
    ADULT_15P_DX = MALE_DX - {"rpL7wMYNPDH", "s9iBEnfSHhh", "JprDjnAyB0f", "PG5Ynz9xGCu"} | {
        "NBMvd95wp7t", "X7QikQUsYB1", "MOqDhGiw7W6", "BFbmB3WxGPd",
        "xz2f0oONxQx", "f59E1kimKqe", "UjIzCVxESAz", "Y4jKOMblgII",
        "hUHq4KO9YMz", "tWTgIibsKJ5", "AFdikiNpC3e", "GMoRCzegC6C",
        "Bs5etPcLz7w", "Ps8a7Mv1xIn", "sQcd8UD8Mrs",
    }

    try:
        raw_path = BASE_DIR / "data" / "dhis" / "raw" / "hiv_newly_started_art.csv"
        ou_path = BASE_DIR / "data" / "dhis" / "meta" / "organisation_units.csv"
        if not raw_path.exists():
            return jsonify(json_safe({"error": "Raw data not found."})), 404

        df = pd.read_csv(raw_path)
        ou_df = pd.read_csv(ou_path)
        ou_name = dict(zip(ou_df["id"].astype(str), ou_df["name"]))
        ou_path_map = dict(zip(ou_df["id"].astype(str), ou_df["path"].astype(str)))

        def get_county(oid: str) -> str:
            p = ou_path_map.get(oid, "")
            parts = p.split("/")
            if len(parts) >= 3:
                return ou_name.get(parts[2], parts[2])
            return "Unknown"

        df["county"] = df["ou"].map(get_county)
        df = df[df["county"] == county_filter]

        # Total TX_NEW
        total = df[df["dx"] == "gv7bbGesTTJ"]
        total_agg = total.groupby("pe", as_index=False)["value"].sum()

        # Males TX_NEW
        males = df[df["dx"].isin(MALE_DX)]
        males_agg = males.groupby("pe", as_index=False)["value"].sum()

        # Adults 15+
        adults = df[df["dx"].isin(ADULT_15P_DX)]
        adults_agg = adults.groupby("pe", as_index=False)["value"].sum()

        all_periods = sorted(set(
            list(total["pe"].unique()) +
            list(males["pe"].unique()) +
            list(adults["pe"].unique())
        ), reverse=True)

        def to_label(p):
            s = str(int(p))
            return f"{s[:4]}-{s[4:]}" if len(s) == 6 else s

        # Build trend series (chronological order)
        periods_chrono = sorted(all_periods)
        trend = []
        for p in periods_chrono:
            t_row = total_agg[total_agg["pe"] == p]
            m_row = males_agg[males_agg["pe"] == p]
            a_row = adults_agg[adults_agg["pe"] == p]
            trend.append({
                "period": str(int(p)),
                "label": to_label(p),
                "total": round(float(t_row["value"].iloc[0]), 1) if len(t_row) else 0,
                "males": round(float(m_row["value"].iloc[0]), 1) if len(m_row) else 0,
                "adults_15plus": round(float(a_row["value"].iloc[0]), 1) if len(a_row) else 0,
            })

        return jsonify(json_safe({
            "county": county_filter,
            "metrics": [
                {"key": "total", "label": "Newly Started on ART (Total)"},
                {"key": "males", "label": "Males Started on ART"},
                {"key": "adults_15plus", "label": "Adults Started on ART (15+ Yrs)"},
            ],
            "trend": trend,
            "periods": [{"period": str(int(p)), "label": to_label(p)} for p in periods_chrono],
        }))
    except Exception as exc:
        return jsonify(json_safe({"error": str(exc)})), 500
