"""AI chat route with per-chart in-memory SQLite databases."""
from __future__ import annotations

import re
import sqlite3

import pandas as pd
from flask import Blueprint, jsonify, request

from services.ai import (
    build_chat_response,
    build_fallback_sql,
    generate_sql,
    run_safe_query,
    validate_sql,
)
from services.common import json_safe

chat_bp = Blueprint("chat", __name__)

_app = None  # set by register_chat_blueprint


def register_chat_blueprint(app):
    global _app
    _app = app
    app.register_blueprint(chat_bp)
    print("[CHAT] Blueprint registered")


def _build_chart_database(chart_data: dict) -> tuple:
    """Create a temp in-memory database from chart data (labels + datasets).
    Returns (connection, schema_sql, table_info_string)."""
    labels = chart_data.get("labels", [])
    datasets = chart_data.get("datasets", [])
    if not labels or not datasets:
        return None, "", ""
    # Build unique sanitized column names
    col_mapping = []  # list of (sanitized, raw_name)
    seen = set()
    for ds in datasets:
        raw_name = ds.get("label", "value") or "value"
        base = re.sub(r'[^a-zA-Z0-9_]', '_', raw_name).strip('_') or "col"
        name = base
        i = 1
        while name in seen:
            name = f"{base}_{i}"
            i += 1
        seen.add(name)
        col_mapping.append((name, raw_name))
    rows = []
    for i, label in enumerate(labels):
        row = {"label": str(label)}
        for j, (col_name, _) in enumerate(col_mapping):
            val = datasets[j].get("data", [])[i] if i < len(datasets[j].get("data", [])) else None
            row[col_name] = val
        rows.append(row)
    chart_df = pd.DataFrame(rows)
    chart_conn = sqlite3.connect(":memory:")
    chart_df.to_sql("chart_data", chart_conn, index=False, if_exists="replace")
    chart_schema = pd.io.sql.get_schema(chart_df, "chart_data", con=chart_conn)
    col_descs = []
    for c in chart_df.columns:
        if c == "label":
            col_descs.append('"label" (the month/label row)')
        else:
            raw = next((r for s, r in col_mapping if s == c), c)
            col_descs.append(f'"{c}" (represents: {raw})')
    table_info = f'The ONLY table available is "chart_data" with columns: {", ".join(col_descs)}.'
    return chart_conn, chart_schema, table_info


@chat_bp.post("/api/chat")
def chat() -> object:
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or payload.get("message") or "").strip()
    chart_id = (payload.get("chart_id") or "").strip()
    chart_data = payload.get("chart_data")
    active_page = (payload.get("active_page") or "").strip()
    active_tab = (payload.get("active_tab") or "").strip()

    if not question:
        return jsonify(json_safe({"error": "A question is required."})), 400

    # Build page/tab context hint for the AI
    page_context = ""
    if active_page:
        page_context = f"The user is currently viewing the '{active_page}' dashboard page"
        if active_tab:
            page_context += f", tab '{active_tab}'"
        page_context += ". "

    normalized_question = re.sub(r"\s+", " ", question.lower()).strip()
    cache_key = f"{chart_id}::{normalized_question}"
    with _app.config["AI_RESPONSE_CACHE_LOCK"]:
        cached_response = _app.config["AI_RESPONSE_CACHE"].get(cache_key)
    if cached_response is not None:
        return jsonify(json_safe(cached_response))

    try:
        # ── Determine whether we query chart data or the main clinics table ──
        chart_db = None
        chart_schema = None
        custom_table_info = ""
        if chart_data:
            chart_db, chart_schema, custom_table_info = _build_chart_database(chart_data)
            if chart_db:
                print(f"[CHART AI] Built chart database from {len(chart_data.get('labels',[]))} labels")
            else:
                print(f"[CHART AI] chart_data had no labels/datasets: {chart_data}")

        if chart_db is not None:
            # Per-chart mode: query against the chart's data
            used_schema = chart_schema
            chart_df_check = pd.read_sql_query("SELECT * FROM chart_data", chart_db)
            used_columns = list(chart_df_check.columns)
            query_connection = chart_db
            print(f"[CHART AI] Using chart_data table, columns={used_columns}")
        else:
            # Main chat mode: query against the clinics table
            used_schema = _app.config["SCHEMA_SQL"]
            used_columns = _app.config["DATAFRAME"].columns.tolist()
            query_connection = _app.config["DATABASE_CONNECTION"]

        # Inject page context into the question so AI knows what data the user is looking at
        contextualized_question = page_context + question if page_context else question

        sql_query, sql_source, ai_error = generate_sql(
            _app.config["GEMINI_PROVIDERS"],
            _app.config["GEMINI_ROUTER_STATE"],
            contextualized_question,
            used_columns,
            used_schema,
            chart_id=chart_id,
            custom_table_info=custom_table_info,
        )
        if sql_query is None:
            # No provider could produce a SQL query; try local fallback
            fallback_sql = build_fallback_sql(question, used_columns)
            if fallback_sql:
                print(f"[CHART AI] Using fallback SQL: {fallback_sql[:200]}")
                validated_sql = validate_sql(fallback_sql, used_columns)
                result_frame = run_safe_query(query_connection, validated_sql)
                response_payload = build_chat_response(question, validated_sql, result_frame, "fallback", chart_id=chart_id)
                if ai_error:
                    response_payload["ai_error"] = str(ai_error)
                with _app.config["AI_RESPONSE_CACHE_LOCK"]:
                    _app.config["AI_RESPONSE_CACHE"][cache_key] = response_payload
                return jsonify(json_safe(response_payload))
            return jsonify(json_safe({"error": f"AI providers failed: {ai_error}"})), 502
        print(f"[CHART AI] AI generated SQL: {sql_query[:200]}")
        validated_sql = validate_sql(sql_query, used_columns)
        result_frame = run_safe_query(query_connection, validated_sql)
        # If AI returned empty results, try local fallback
        if result_frame.empty and chart_db is None:
            fallback_sql = build_fallback_sql(question, used_columns)
            if fallback_sql:
                validated_sql = validate_sql(fallback_sql, used_columns)
                result_frame = run_safe_query(query_connection, validated_sql)
                sql_source = "fallback"
        response_payload = build_chat_response(question, validated_sql, result_frame, sql_source, chart_id=chart_id)
        if ai_error:
            # include AI error details to help debugging in the UI
            response_payload["ai_error"] = str(ai_error)
        with _app.config["AI_RESPONSE_CACHE_LOCK"]:
            _app.config["AI_RESPONSE_CACHE"][cache_key] = response_payload
        return jsonify(json_safe(response_payload))
    except ValueError as exc:
        return jsonify(json_safe({"error": str(exc)})), 400
    except sqlite3.Error as exc:
        return jsonify(json_safe({"error": f"Database query failed: {exc}"})), 400
    except Exception as exc:  # pragma: no cover - defensive guard for production runtime
        return jsonify(json_safe({"error": f"Unexpected server error: {exc}"})), 500
