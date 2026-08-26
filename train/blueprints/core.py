"""Core routes: index, health, data, facilities, debug, and asset serving."""
from __future__ import annotations

from flask import Blueprint, jsonify, request, send_from_directory

from services.ai import genai
from services.common import build_facility_page, json_safe
from services.paths import BASE_DIR, TABLE_NAME
from services.superpower import HAS_SUPERPOWER

core_bp = Blueprint("core", __name__)

_app = None  # set by register_core_blueprint
_reload_csvs = None  # closure from create_app


def register_core_blueprint(app, reload_csvs=None):
    """Register the core blueprint on the Flask app.
    reload_csvs: the scan_and_load_additional_csvs closure from create_app."""
    global _app, _reload_csvs
    _app = app
    _reload_csvs = reload_csvs
    app.register_blueprint(core_bp)
    print("[CORE] Blueprint registered")


@core_bp.get("/")
def index() -> object:
    index_path = BASE_DIR / "index.html"
    if index_path.exists():
        return send_from_directory(BASE_DIR, "index.html")
    return jsonify(
        {
            "message": "Executive Intelligence Dashboard backend is running.",
            "endpoints": ["/api/dashboard-data", "/api/chat"],
        }
    )


@core_bp.get("/api/health")
def health() -> object:
    return jsonify(json_safe({"status": "ok"}))


@core_bp.get("/api/dashboard-data")
def dashboard_data() -> object:
    return jsonify(
        json_safe(
            {
                "table": TABLE_NAME,
                "row_count": int(len(_app.config["DATAFRAME"])),
                "columns": list(_app.config["DATAFRAME"].columns),
                "data": _app.config["DATAFRAME"].to_dict(orient="records"),
            }
        )
    )


@core_bp.get("/api/catalog")
def catalog() -> object:
    return jsonify(json_safe(_app.config["CATALOG"]))


@core_bp.get("/api/facilities")
def facilities() -> object:
    page = max(int(request.args.get("page", 1)), 1)
    page_size = min(max(int(request.args.get("page_size", 20)), 5), 100)
    search = (request.args.get("search") or "").strip().lower()
    payload = build_facility_page(
        _app.config["DATAFRAME"],
        page=page,
        page_size=page_size,
        search=search,
        location_hierarchy=_app.config.get("LOCATION_HIERARCHY"),
        hospitals_frame=_app.config.get("HOSPITALS_TABLE"),
        org_units_map=_app.config.get("ORG_UNITS_LOOKUP", {}),
        hospital_map=_app.config.get("HOSPITALS_LOOKUP", {}),
    )
    return jsonify(json_safe(payload))


@core_bp.get("/main.js")
def main_js() -> object:
    response = send_from_directory(BASE_DIR, "main.js")
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@core_bp.get("/js/<path:filename>")
def js_assets(filename: str) -> object:
    """Serve the per-domain / per-chart split JS files (train/js/*.js).
    No-cache so edits to any chart file show up immediately on refresh."""
    response = send_from_directory(BASE_DIR / "js", filename)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@core_bp.post("/api/reload-csvs")
def reload_csvs_endpoint() -> object:
    try:
        # call the scanner and return loaded files
        added = _reload_csvs()
        return jsonify(json_safe({"loaded_files": [str(p) for p in added]}))
    except Exception as exc:
        return jsonify(json_safe({"error": str(exc)})), 500


@core_bp.get("/api/ai-status")
def ai_status() -> object:
    try:
        providers = _app.config.get("GEMINI_PROVIDERS", [])
        router = _app.config.get("GEMINI_ROUTER_STATE", {})
        cache_size = len(_app.config.get("AI_RESPONSE_CACHE", {}))
        sdk_present = genai is not None
        return jsonify(
            json_safe(
                {
                    "providers_count": len(providers),
                    "providers": providers,
                    "router_state": router,
                    "ai_response_cache_size": cache_size,
                    "sdk_present": bool(sdk_present),
                }
            )
        )
    except Exception as exc:
        return jsonify(json_safe({"error": str(exc)})), 500


@core_bp.post("/api/clear-ai-cache")
def clear_ai_cache() -> object:
    try:
        with _app.config["AI_RESPONSE_CACHE_LOCK"]:
            _app.config["AI_RESPONSE_CACHE"].clear()
        return jsonify(json_safe({"cleared": True, "ai_response_cache_size": 0}))
    except Exception as exc:
        return jsonify(json_safe({"error": str(exc)})), 500


@core_bp.get("/api/debug/check")
def debug_check():
    return jsonify({"status": "alive", "has_superpower": HAS_SUPERPOWER})


@core_bp.get("/api/debug/routes")
def debug_routes():
    rules = sorted([r.rule for r in _app.url_map.iter_rules()])
    return jsonify({"routes": rules, "count": len(rules)})
