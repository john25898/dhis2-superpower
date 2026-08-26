"""CHAK DHIS2 Exploration Data API (module-level app routes from the monolith)."""
from __future__ import annotations

import json

from flask import Blueprint, jsonify

from services.paths import BASE_DIR

chak_explore_bp = Blueprint("chak_explore", __name__)

_app = None  # set by register_chak_explore_blueprint

# ── CHAK DHIS2 Exploration Data API ────────────────────────
_CHAK_EXPLORE_DIR = BASE_DIR.parent / "dictionaries" / "chak_dhis2_explore"


def register_chak_explore_blueprint(app):
    global _app
    _app = app
    app.register_blueprint(chak_explore_bp)
    print("[CHAK-EXPLORE] Blueprint registered")


@chak_explore_bp.route("/api/chak-explore/<path:filename>")
def chak_explore_data(filename):
    """Serve CHAK DHIS2 exploration JSON files."""
    if not filename.endswith(".json"):
        return jsonify({"error": "Only JSON files allowed"}), 400
    safe_path = (_CHAK_EXPLORE_DIR / filename).resolve()
    if not str(safe_path).startswith(str(_CHAK_EXPLORE_DIR.resolve())):
        return jsonify({"error": "Invalid path"}), 403
    if not safe_path.exists():
        return jsonify({"error": "File not found"}), 404
    try:
        with open(safe_path, encoding="utf-8") as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@chak_explore_bp.route("/api/chak-explore/dataset/<dataset_id>")
def chak_explore_dataset_detail(dataset_id):
    """Return full details for a specific CHAK dataset by ID."""
    ds_path = _CHAK_EXPLORE_DIR / "dataSets.json"
    try:
        with open(ds_path, encoding="utf-8") as f:
            data = json.load(f)
        for ds in data.get("dataSets", []):
            if ds["id"] == dataset_id:
                # Transform to frontend-friendly format
                elements = []
                for dse in ds.get("dataSetElements", []):
                    de = dse.get("dataElement", {})
                    elements.append({
                        "id": de.get("id", ""),
                        "name": de.get("name", ""),
                        "valueType": de.get("valueType", ""),
                        "categoryCombo": de.get("categoryCombo", {}),
                    })
                return jsonify({
                    "ok": True,
                    "dataset": {
                        "id": ds["id"],
                        "name": ds.get("name", ""),
                        "shortName": ds.get("shortName", ""),
                        "periodType": ds.get("periodType", ""),
                        "dataElements": elements,
                        "totalElements": len(elements),
                    }
                })
        return jsonify({"ok": False, "error": "Dataset not found"}), 404
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@chak_explore_bp.route("/api/chak-explore/dashboard/<dashboard_id>")
def chak_explore_dashboard_detail(dashboard_id):
    """Return full details for a specific dashboard by ID."""
    db_path = _CHAK_EXPLORE_DIR / "dashboards.json"
    try:
        with open(db_path, encoding="utf-8") as f:
            data = json.load(f)
        for db in data.get("dashboards", []):
            if db["id"] == dashboard_id:
                return jsonify(db)
        return jsonify({"error": "Dashboard not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
