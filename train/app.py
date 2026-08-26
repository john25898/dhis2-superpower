"""CHAK VISTA Executive Intelligence Dashboard — Flask application factory.

Modular architecture (refactored from a single 5,600-line monolith):

  services/   — pure logic, no Flask: paths, superpower, database, common,
                hierarchy, ai, ou_resolver, dhis2, khis, portfolio
  blueprints/ — per-domain route groups, each registered in create_app():
                core, chat, jt, mhu, hiv, portfolio, chak_explore
  pbix_dashboards.py — legacy CHAK Visuals (16 pages) blueprint

The factory keeps everything importable from `app` as before:
    from app import create_app
    from app import load_datim_hiv_treatment_sections   (re-exported)
"""
from __future__ import annotations

import gzip
import json
import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

# ── Environment bootstrap (MUST come first: parses train/.env into os.environ) ──
from services.paths import (  # noqa: E402,F401
    BASE_DIR,
    CSV_PATH,
    GUIDE_XLSX_PATH,
    TABLE_NAME,
)
from services.superpower import HAS_SUPERPOWER  # noqa: E402,F401  (used by debug/check)
from services.database import initialize_database, load_source_dataframe
from services.common import (
    build_canonical_catalog,
    clean_text,
    json_safe,
    normalize_dhis_analytics_frame,
    resolve_unit_context,
)
from services.hierarchy import (
    load_datim_hiv_treatment_sections,  # re-exported for backend/dhis_export.py
    load_datim_location_hierarchy,
)
from services.ai import build_gemini_providers, build_groq_providers
from services.dhis2 import _dhis2_fetch
from services.ou_resolver import _resolve_ou_ids

load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    database = initialize_database(CSV_PATH)
    dataframe = load_source_dataframe(CSV_PATH)
    schema_sql = pd.io.sql.get_schema(dataframe, TABLE_NAME, con=database)

    app.config["DATABASE_CONNECTION"] = database
    app.config["DATABASE_LOCK"] = threading.Lock()
    app.config["DATAFRAME"] = dataframe
    app.config["SCHEMA_SQL"] = schema_sql
    app.config["GEMINI_PROVIDERS"] = build_gemini_providers() + build_groq_providers()
    app.config["GEMINI_ROUTER_STATE"] = {"cursor": 0, "cooldowns": {}}
    app.config["AI_RESPONSE_CACHE"] = {}
    app.config["AI_RESPONSE_CACHE_LOCK"] = threading.Lock()
    app.config["CATALOG"] = build_canonical_catalog(dataframe)
    app.config["SOURCE_DATASETS"] = {}
    app.config["LOCATION_HIERARCHY"] = load_datim_location_hierarchy(GUIDE_XLSX_PATH)
    # CSV loader paused — kept for future reference:
    # csv_hierarchy_path = BASE_DIR / "location_hierarchy.csv"
    # app.config["LOCATION_HIERARCHY"] = load_location_hierarchy_from_csv(csv_hierarchy_path)
    # if not app.config["LOCATION_HIERARCHY"].get("counties"):
    #     app.config["LOCATION_HIERARCHY"] = load_datim_location_hierarchy(GUIDE_XLSX_PATH)
    app.config["DATIM_HIV_TREATMENT_SECTIONS"] = load_datim_hiv_treatment_sections(GUIDE_XLSX_PATH)
    # track additional CSVs loaded from data/dhis
    app.config["LOADED_CSVS"] = set()

    # Purge any stale fallback/local cached responses that may exist from previous runs.
    try:
        with app.config["AI_RESPONSE_CACHE_LOCK"]:
            keys_to_remove = [k for k, v in (app.config.get("AI_RESPONSE_CACHE") or {}).items() if isinstance(v, dict) and v.get("source") in ("fallback", "no_gemini", "local")]
            for k in keys_to_remove:
                app.config["AI_RESPONSE_CACHE"].pop(k, None)
            # If any entries remain, ensure the cache is empty on fresh startup
            if app.config.get("AI_RESPONSE_CACHE"):
                app.config["AI_RESPONSE_CACHE"].clear()
    except Exception:
        # don't fail startup for caching cleanup issues
        pass

    def scan_and_load_additional_csvs():
        """Scan data/dhis/raw and data/dhis/processed for CSV files and merge them into the main dataframe.

        This function is idempotent and will skip files already loaded. It attempts to transform
        DHIS analytics rows (dx,pe,ou,value) into friendly columns (Indicator, Month, Facility,
        Total_Visits / Monthly_Expenditure_USD) before merging so the UI filters can pick them up.
        """
        raw_dir = BASE_DIR / "data" / "dhis" / "raw"
        proc_dir = BASE_DIR / "data" / "dhis" / "processed"
        candidates = []
        for folder in (raw_dir, proc_dir):
            try:
                for p in folder.glob("*.csv"):
                    candidates.append(p)
            except Exception:
                continue

        new_files = [p for p in candidates if str(p) not in app.config["LOADED_CSVS"]]
        if not new_files:
            return []

        # load metadata maps if available
        meta_dir = BASE_DIR / "data" / "dhis" / "meta"
        data_elements_map = {}
        org_units_map = {}
        try:
            de_path = meta_dir / "data_elements.csv"
            if de_path.exists():
                df_de = pd.read_csv(de_path)
                if "id" in df_de.columns and "name" in df_de.columns:
                    data_elements_map = dict(zip(df_de["id"].astype(str), df_de["name"]))
        except Exception:
            pass
        try:
            ind_path = meta_dir / "indicators.csv"
            if ind_path.exists():
                df_ind = pd.read_csv(ind_path)
                if "id" in df_ind.columns and "name" in df_ind.columns:
                    for indicator_id, indicator_name in zip(df_ind["id"].astype(str), df_ind["name"]):
                        data_elements_map.setdefault(indicator_id, indicator_name)
        except Exception:
            pass
        try:
            ou_path = meta_dir / "organisation_units.csv"
            if ou_path.exists():
                df_ou = pd.read_csv(ou_path)
                if "id" in df_ou.columns:
                    org_units_map = {
                        clean_text(row.get("id")): row.to_dict()
                        for _, row in df_ou.iterrows()
                        if clean_text(row.get("id"))
                    }
        except Exception:
            pass

        app.config["ORG_UNITS_LOOKUP"] = org_units_map

        hospital_map: dict[str, dict[str, Any]] = {}
        try:
            hospitals_path = proc_dir / "hospitals.csv"
            if hospitals_path.exists():
                df_hospitals = pd.read_csv(hospitals_path)
                app.config["HOSPITALS_TABLE"] = df_hospitals.copy()
                required_columns = {"hospital_id", "hospital_name", "path", "level"}
                if required_columns.issubset(df_hospitals.columns):
                    hospital_map = {
                        clean_text(row.get("hospital_id")): {
                            "hospital_name": clean_text(row.get("hospital_name")),
                            "path": clean_text(row.get("path")),
                            "level": row.get("level"),
                        }
                        for _, row in df_hospitals.iterrows()
                        if clean_text(row.get("hospital_id"))
                    }
        except Exception:
            app.logger.exception("Failed to preload hospital metadata")

        app.config["HOSPITALS_LOOKUP"] = hospital_map

        frames = []
        source_datasets: dict[str, pd.DataFrame] = {}
        for p in new_files:
            try:
                df = pd.read_csv(p)
                if df.empty:
                    app.logger.debug("Skipping empty CSV: %s", p)
                    app.config["LOADED_CSVS"].add(str(p))
                    continue

                lower_name = p.name.lower()
                if lower_name == "hospitals.csv":
                    app.config["LOADED_CSVS"].add(str(p))
                    app.logger.info("Loaded hospital lookup table: %s (%d rows)", p.name, len(df))
                    continue

                if lower_name == "dhis_combined.csv":
                    app.config["LOADED_CSVS"].add(str(p))
                    app.logger.info("Skipped pre-combined DHIS CSV: %s", p.name)
                    continue

                # detect DHIS analytics table format: dx,pe,ou,value
                cols = [c.lower() for c in df.columns]
                if set(cols) >= {"dx", "pe", "ou", "value"}:
                    transformed = normalize_dhis_analytics_frame(
                        df,
                        p.name,
                        data_elements_map,
                        org_units_map,
                        hospital_map,
                    )
                    frames.append(transformed)
                    source_datasets[p.name] = transformed
                    app.config["LOADED_CSVS"].add(str(p))
                    app.logger.info("Transformed DHIS analytics CSV: %s -> %d rows", p.name, len(transformed))
                    continue

                # otherwise append as-is but ensure no duplicate column names
                app.config["LOADED_CSVS"].add(str(p))
                app.logger.info("Loaded non-analytics CSV without merging: %s (%d rows)", p.name, len(df))
            except Exception as exc:
                app.logger.warning("Failed to load CSV %s: %s", p, exc)

        if not frames:
            return new_files

        try:
            # Always keep the original CSV-backed dataframe and append any newly loaded DHIS frames.
            base_frames = [app.config["DATAFRAME"]] + frames
            combined = pd.concat(base_frames, ignore_index=True, sort=False)
            # normalize column order by reindexing
            combined = combined.loc[:, ~combined.columns.duplicated()]
            # Normalize Month column to consistent YYYYMM string where possible to avoid mixed-type sorting errors
            if "Month" in combined.columns:
                s = combined["Month"].fillna("").astype(str).str.strip()
                # remove non-digits to handle formats like '2025-12' or '2025/12'
                s_clean = s.str.replace(r"[^0-9]", "", regex=True)
                # keep only first 6 digits if present
                s_clean = s_clean.str.slice(0, 6)
                mask6 = s_clean.str.match(r"^\d{6}$")
                # where we have a 6-digit YYYYMM, use it; otherwise fall back to original string (trimmed)
                combined["Month"] = s_clean.where(mask6, s)
                # ensure uniform string dtype
                combined["Month"] = combined["Month"].astype(str)

            if "Facility" in combined.columns and hospital_map:
                facility_context = combined["Facility"].astype(str).map(
                    lambda unit_id: resolve_unit_context(unit_id, org_units_map, hospital_map)
                )
                combined["Facility"] = facility_context.map(lambda context: context["Facility"])

                county_values = facility_context.map(lambda context: context["County"])
                subcounty_values = facility_context.map(lambda context: context["SubCounty"])

                if "County" not in combined.columns:
                    combined["County"] = county_values
                else:
                    combined["County"] = combined["County"].fillna("").astype(str)
                    combined["County"] = combined["County"].where(combined["County"].str.strip() != "", county_values)

                if "SubCounty" not in combined.columns:
                    combined["SubCounty"] = subcounty_values
                else:
                    combined["SubCounty"] = combined["SubCounty"].fillna("").astype(str)
                    combined["SubCounty"] = combined["SubCounty"].where(combined["SubCounty"].str.strip() != "", subcounty_values)

            app.config["DATAFRAME"] = combined
            app.config["SOURCE_DATASETS"] = source_datasets
            # update sqlite table
            with app.config["DATABASE_LOCK"]:
                conn = app.config["DATABASE_CONNECTION"]
                combined.to_sql(TABLE_NAME, conn, index=False, if_exists="replace")
            # refresh schema and registries
            app.config["SCHEMA_SQL"] = pd.io.sql.get_schema(combined, TABLE_NAME, con=app.config["DATABASE_CONNECTION"]) if not combined.empty else app.config.get("SCHEMA_SQL")
            app.config["CATALOG"] = build_canonical_catalog(combined)
        except Exception as exc:
            app.logger.exception("Failed to merge additional CSVs: %s", exc)

        return new_files

    def csv_watcher_loop(interval_seconds: int = 20):
        # simple polling loop that runs in a daemon thread
        while True:
            try:
                added = scan_and_load_additional_csvs()
                if added:
                    app.logger.info("CSV watcher loaded %d new files", len(added))
                time.sleep(interval_seconds)
            except Exception:
                app.logger.exception("CSV watcher encountered an error")
                time.sleep(interval_seconds)

    # load once at startup so the first request sees the enriched data
    scan_and_load_additional_csvs()

    # start watcher thread
    watcher = threading.Thread(target=csv_watcher_loop, args=(20,), daemon=True)
    watcher.start()

    @app.after_request
    def compress_response(response):
        if response.direct_passthrough:
            return response

        accept_encoding = request.headers.get("Accept-Encoding", "")
        if "gzip" not in accept_encoding.lower():
            return response

        content_type = response.headers.get("Content-Type", "")
        if not any(
            token in content_type
            for token in ("application/json", "text/html", "text/javascript", "application/javascript")
        ):
            return response

        payload = response.get_data()
        if len(payload) < 1024 or response.headers.get("Content-Encoding"):
            return response

        compressed = gzip.compress(payload)
        response.set_data(compressed)
        response.headers["Content-Encoding"] = "gzip"
        response.headers["Content-Length"] = str(len(compressed))
        response.headers.add("Vary", "Accept-Encoding")
        return response

    # ── Register per-domain blueprints ────────────────────────────────────
    from blueprints.core import register_core_blueprint
    register_core_blueprint(app, scan_and_load_additional_csvs)

    from blueprints.chat import register_chat_blueprint
    register_chat_blueprint(app)

    from blueprints.jt import register_jt_blueprint
    register_jt_blueprint(app)

    from blueprints.mhu import register_mhu_blueprint
    register_mhu_blueprint(app)

    from blueprints.hiv import register_hiv_blueprint
    register_hiv_blueprint(app)

    from blueprints.portfolio import register_portfolio_blueprint
    register_portfolio_blueprint(app)

    from blueprints.chak_explore import register_chak_explore_blueprint
    register_chak_explore_blueprint(app)

    # ── Register PBIX Dashboard Blueprint (16 CHAK Visuals pages) ──
    try:
        from pbix_dashboards import register_pbix_blueprint
        register_pbix_blueprint(app, _dhis2_fetch, _resolve_ou_ids)
    except Exception as exc:
        app.logger.exception("Failed to register pbix_dashboards blueprint: %s", exc)

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    # Debug: print registered routes
    rules = sorted([r.rule for r in app.url_map.iter_rules()])
    print(f"Registered {len(rules)} routes:")
    for r in rules:
        if "dhis" in r or "debug" in r:
            print(f"  *** {r}")
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False, threaded=True)
