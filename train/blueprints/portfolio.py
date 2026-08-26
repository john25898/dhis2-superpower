"""Project Portfolio Performance Monitoring: seed data, filters, project details."""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.common import json_safe
from services.portfolio import (
    PROJECT_NARRATIVES,
    _filter_performance_by_geography,
    _generate_performance_seed_data,
    _load_geography_hierarchy,
    load_project_performance_data,
)

portfolio_bp = Blueprint("portfolio", __name__)

_app = None  # set by register_portfolio_blueprint


def register_portfolio_blueprint(app):
    global _app
    _app = app
    app.register_blueprint(portfolio_bp)
    print("[PORTFOLIO] Blueprint registered")


# ────────────────────────────────────────────────────────────
# PROJECT PERFORMANCE MONITORING — API Endpoints
# ────────────────────────────────────────────────────────────

@portfolio_bp.get("/api/project-portfolio")
def project_portfolio() -> object:
    """Return the full project portfolio dashboard."""
    try:
        data = load_project_performance_data()
        if "error" in data:
            return jsonify(json_safe({"ok": False, "error": data["error"]}))
        return jsonify(json_safe({"ok": True, **data}))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500


# ────────────────────────────────────────────────────────────
# PROJECT PERFORMANCE — Seed Data & Filter Endpoints
# ────────────────────────────────────────────────────────────

@portfolio_bp.get("/api/project-portfolio/geographies")
def project_geographies() -> object:
    """Return available counties, subcounties, and facilities."""
    try:
        geo = _load_geography_hierarchy()
        return jsonify(json_safe({"ok": True, **geo}))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500


@portfolio_bp.get("/api/project-portfolio/narratives")
def project_narratives() -> object:
    """Return all project narratives."""
    try:
        data = load_project_performance_data()
        if "error" in data:
            return jsonify(json_safe({"ok": False, "error": data["error"]}))
        narratives = {}
        for slug, project in data.get("projects", {}).items():
            # Get seed narrative if available
            seed_narrative = PROJECT_NARRATIVES.get(slug, {})
            narratives[slug] = {
                "slug": slug,
                "project_name": project.get("donor", ""),
                "reporting_month": project.get("reporting_month", ""),
                "overall_rag": project.get("section_c", {}).get("overall_rag", "N/A"),
                "narrative": seed_narrative.get("narrative_text", ""),
                "key_achievements": seed_narrative.get("key_achievements", ""),
            }
        return jsonify(json_safe({"ok": True, "narratives": narratives}))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500


@portfolio_bp.get("/api/project-portfolio/seed")
def project_seed_data() -> object:
    """Return seeded geographic breakdown data."""
    try:
        seed = _generate_performance_seed_data()
        if "error" in seed:
            return jsonify(json_safe({"ok": False, "error": seed["error"]}))
        return jsonify(json_safe({"ok": True, **seed}))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500


@portfolio_bp.get("/api/project-portfolio/filtered")
def project_filtered() -> object:
    """Return project performance data filtered by geography.
    Query params: county, subcounty, facility, project"""
    try:
        county = request.args.get("county")
        subcounty = request.args.get("subcounty")
        facility = request.args.get("facility")
        project = request.args.get("project")
        result = _filter_performance_by_geography(county, subcounty, facility, project)
        return jsonify(json_safe({"ok": True, **result}))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500


@portfolio_bp.post("/api/project-portfolio/regenerate-seed")
def regenerate_seed() -> object:
    """Force regenerate the seed data."""
    try:
        seed = _generate_performance_seed_data(force_reload=True)
        return jsonify(json_safe({"ok": True, **seed}))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500


# ────────────────────────────────────────────────────────────
# PROJECT PERFORMANCE — Project Detail Endpoints
# ────────────────────────────────────────────────────────────

@portfolio_bp.get("/api/project-portfolio/<slug>")
def project_detail(slug: str) -> object:
    """Return a single project's detailed data."""
    try:
        data = load_project_performance_data()
        if "error" in data:
            return jsonify(json_safe({"ok": False, "error": data["error"]}))
        project = data.get("projects", {}).get(slug)
        if not project:
            return jsonify(json_safe({"ok": False, "error": f"Project '{slug}' not found"})), 404
        return jsonify(json_safe({"ok": True, "project": project}))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500


@portfolio_bp.get("/api/project-portfolio/<slug>/chart-data")
def project_chart_data(slug: str) -> object:
    """Return pre-computed chart data for a project."""
    try:
        data = load_project_performance_data()
        if "error" in data:
            return jsonify(json_safe({"ok": False, "error": data["error"]}))
        project = data.get("projects", {}).get(slug)
        if not project:
            return jsonify(json_safe({"ok": False, "error": f"Project '{slug}' not found"})), 404

        sec_a = project.get("section_a", {})
        budget_lines = sec_a.get("budget_lines", [])
        sec_b = project.get("section_b", {})
        indicators = sec_b.get("indicators", [])
        sec_c = project.get("section_c", {})

        # ── Budget Burn Rate (bar: actual vs planned per budget line) ──
        burn_chart = {
            "categories": [bl["budget_line"] for bl in budget_lines],
            "planned": [bl["planned_cumulative"] for bl in budget_lines],
            "actual": [bl["actual_cumulative"] for bl in budget_lines],
        }

        # ── Indicator Achievement ──
        indicator_chart = {
            "categories": [ind["indicator"] for ind in indicators],
            "annual_targets": [ind["annual_target"] for ind in indicators],
            "actual_results": [ind["actual_cumulative"] for ind in indicators],
            "achievement_pcts": [ind["achievement_pct"] for ind in indicators],
        }

        # ── Budget Line RAG Distribution ──
        rag_dist = {"On Track": 0, "Watch": 0, "Off Track": 0, "N/A": 0}
        for bl in budget_lines:
            r = bl.get("rag", "N/A")
            if r in rag_dist:
                rag_dist[r] += 1
            else:
                rag_dist["N/A"] += 1

        return jsonify(json_safe({
            "ok": True,
            "slug": slug,
            "burn_chart": burn_chart,
            "indicator_chart": indicator_chart,
            "rag_distribution": rag_dist,
            "overall_rag": sec_c.get("overall_rag", "N/A"),
            "financial_rag": sec_c.get("financial_rag", "N/A"),
            "technical_rag": sec_c.get("technical_rag", "N/A"),
            "total_annual_budget": sec_a.get("total_annual_budget", 0),
            "total_expenditure": sec_a.get("total_cumulative_expenditure", 0),
            "total_variance_pct": sec_a.get("total_variance_pct"),
        }))
    except Exception as exc:
        return jsonify(json_safe({"ok": False, "error": str(exc)})), 500
