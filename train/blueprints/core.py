"""Core routes: index, health, data, facilities, debug, and asset serving."""
from __future__ import annotations

import gzip
import hashlib

from flask import Blueprint, Response, jsonify, request, send_from_directory

try:  # Flask >= 2.2 exposes its own JSON provider; keep stdlib as fallback
    from flask import json as flask_json
except Exception:  # pragma: no cover
    import json as flask_json

from services.ai import genai
from services.common import build_facility_page, json_safe
from services.paths import BASE_DIR, TABLE_NAME
from services.superpower import HAS_SUPERPOWER

core_bp = Blueprint("core", __name__)

_app = None  # set by register_core_blueprint
_reload_csvs = None  # closure from create_app

# Memo for /api/dashboard-data.  The body is ~9 MB, so rebuilding it per
# request (`to_dict` + `json_safe` + `jsonify`) cost ~12 s on a cold worker.
# Keyed on the dataframe OBJECT (`is`), not a timestamp: reload_csvs() does
# `app.config["DATAFRAME"] = combined`, i.e. it REPLACES the frame, so the
# identity check invalidates this cache automatically with no manual reset.
# Holding the reference also pins the identity and prevents id() reuse.
# `payload_gz` is the gzip encoding, cached for the same reason as in
# mhu._county_geojson: the app-wide compress_response hook would otherwise
# re-compress 9 MB on every request, 304 revalidations included.
_DASH_CACHE = {"df": None, "payload": None, "payload_gz": None, "etag": None}


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
    """Return the full source dataframe as JSON (~9 MB).

    The serialized body is memoized against the dataframe object itself, so
    a page load costs one dict rebuild and every later load is a memory
    copy.  Cache invalidation is automatic: reload_csvs() replaces
    app.config["DATAFRAME"] with a new object, so the identity check fails
    and the body is rebuilt on the next request.  An ETag lets browsers
    revalidate down to a 304 instead of re-downloading 9 MB, and the gzip
    body is memoized so the app-wide compress_response hook has nothing left
    to do.
    """
    df = _app.config["DATAFRAME"]
    if _DASH_CACHE["df"] is df and _DASH_CACHE["payload"] is not None:
        payload = _DASH_CACHE["payload"]
        payload_gz = _DASH_CACHE["payload_gz"]
        etag = _DASH_CACHE["etag"]
    else:
        body = json_safe(
            {
                "table": TABLE_NAME,
                "row_count": int(len(df)),
                "columns": list(df.columns),
                "data": df.to_dict(orient="records"),
            }
        )
        payload = flask_json.dumps(
            body, separators=(",", ":"), default=str
        ).encode("utf-8")
        # Compress once, here, instead of leaving it to the compress_response
        # hook in app.py: that hook fires on every request (a 304 still holds
        # its body server-side, so the hook re-gzipped all 9 MB each time).
        payload_gz = gzip.compress(payload, compresslevel=6)
        # Unquoted: werkzeug's quote_etag() adds the quotes itself.
        etag = hashlib.sha1(payload).hexdigest()
        # Pin the frame reference so the object identity stays stable.
        _DASH_CACHE.update(
            df=df, payload=payload, payload_gz=payload_gz, etag=etag
        )

    if "gzip" in (request.headers.get("Accept-Encoding") or "").lower():
        resp = Response(payload_gz, mimetype="application/json")
        # Setting Content-Encoding also makes the app-wide compress_response
        # hook skip this response instead of re-compressing it.
        resp.headers["Content-Encoding"] = "gzip"
        resp.set_etag(etag + "-gz")
    else:
        resp = Response(payload, mimetype="application/json")
        resp.set_etag(etag)
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["Vary"] = "Accept-Encoding"
    return resp.make_conditional(request)


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


@core_bp.get("/projects/<path:filename>")
def project_assets(filename: str) -> object:
    """Serve per-project files (train/projects/<slug>/*: config.js, daraja.js, CSVs).
    No-cache so edits to any project file show up immediately on refresh."""
    response = send_from_directory(BASE_DIR / "projects", filename)
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
