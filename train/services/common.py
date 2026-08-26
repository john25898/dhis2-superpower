"""Small shared helpers used across blueprints (no Flask dependencies)."""
from __future__ import annotations

import re
from typing import Any

import pandas as pd

from services.paths import CSV_PATH, TABLE_NAME


def _period_sort_key(period_name):
    """Sort month names chronologically: 'June 2025' < 'September 2025' < 'April 2026'.
    Handles period codes like '202509' as fallback."""
    MONTHS = {
        "January": 1, "February": 2, "March": 3, "April": 4,
        "May": 5, "June": 6, "July": 7, "August": 8,
        "September": 9, "October": 10, "November": 11, "December": 12,
    }
    s = str(period_name)
    parts = s.split()
    if len(parts) >= 2 and parts[0] in MONTHS:
        return (int(parts[1]), MONTHS[parts[0]])
    # Fallback: assume period code like "202509"
    if len(s) == 6 and s.isdigit():
        return (int(s[:4]), int(s[4:]))
    return (0, 0, s)  # put unrecognized at end


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except Exception:
        pass
    return str(value).strip()


def to_int_safe(value: Any) -> int | None:
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    try:
        return int(float(str(value).strip()))
    except Exception:
        return None


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}

    if isinstance(value, list):
        return [json_safe(item) for item in value]

    if isinstance(value, tuple):
        return [json_safe(item) for item in value]

    if isinstance(value, pd.DataFrame):
        return json_safe(value.to_dict(orient="records"))

    if isinstance(value, pd.Series):
        return json_safe(value.tolist())

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        try:
            return json_safe(value.item())
        except Exception:
            pass

    return value


def resolve_unit_context(
    unit_id: Any,
    org_units_map: dict[str, dict[str, Any]],
    hospital_map: dict[str, dict[str, Any]],
) -> dict[str, str]:
    unit_key = clean_text(unit_id)
    record = hospital_map.get(unit_key) or org_units_map.get(unit_key) or {}
    path = clean_text(record.get("path"))
    hierarchy: dict[int, str] = {}

    for ancestor_id in [segment for segment in path.split("/") if segment]:
        ancestor = hospital_map.get(ancestor_id) or org_units_map.get(ancestor_id)
        if not ancestor:
            continue
        level = to_int_safe(ancestor.get("level"))
        ancestor_name = clean_text(ancestor.get("hospital_name") or ancestor.get("name")) or ancestor_id
        if level is not None and level not in hierarchy:
            hierarchy[level] = ancestor_name

    facility_name = clean_text(record.get("hospital_name") or record.get("name")) or unit_key
    if 5 in hierarchy:
        facility_name = hierarchy[5]

    return {
        "Facility": facility_name,
        "County": hierarchy.get(3, ""),
        "SubCounty": hierarchy.get(4, ""),
    }


def normalize_dhis_analytics_frame(
    frame: pd.DataFrame,
    source_file: str,
    data_elements_map: dict[str, str],
    org_units_map: dict[str, dict[str, Any]],
    hospital_map: dict[str, dict[str, Any]],
) -> pd.DataFrame:
    normalized = frame.rename(columns={column: column.lower() for column in frame.columns}).copy()
    numeric_value = pd.to_numeric(normalized.get("value"), errors="coerce")

    transformed = pd.DataFrame()
    transformed["Indicator"] = normalized["dx"].astype(str).map(lambda key: clean_text(data_elements_map.get(key, key)) or key)
    transformed["Month"] = normalized["pe"].astype(str)

    facility_context = normalized["ou"].astype(str).map(lambda unit_id: resolve_unit_context(unit_id, org_units_map, hospital_map))
    transformed["Facility"] = facility_context.map(lambda context: context["Facility"])
    transformed["County"] = facility_context.map(lambda context: context["County"])
    transformed["SubCounty"] = facility_context.map(lambda context: context["SubCounty"])

    transformed["source_file"] = source_file
    transformed["Value"] = numeric_value

    lower_name = source_file.lower()
    if "finance" in lower_name or "spend" in lower_name:
        transformed["Monthly_Expenditure_USD"] = numeric_value
        transformed["Total_Visits"] = 0
    else:
        transformed["Total_Visits"] = numeric_value
        transformed["Monthly_Expenditure_USD"] = 0

    transformed["Cost_Per_ANC_Visit"] = 0
    return transformed


def format_month_label(month_value: Any) -> str:
    if pd.isna(month_value):
        return ""

    text = str(month_value).strip()
    if not text:
        return ""

    if text.isdigit():
        if len(text) == 6:
            return f"{text[:4]}-{text[4:]}"
        return text

    digits_only = re.sub(r"[^0-9]", "", text)
    if len(digits_only) == 6:
        return f"{digits_only[:4]}-{digits_only[4:]}"

    return text


def aggregate_facility_metrics(dataframe: pd.DataFrame) -> pd.DataFrame:
    aggregated = (
        dataframe.groupby("Facility", as_index=False)
        .agg(
            Total_Visits=("Total_Visits", "sum"),
            Monthly_Expenditure_USD=("Monthly_Expenditure_USD", "sum"),
            Avg_Cost_Per_ANC_Visit=("Cost_Per_ANC_Visit", "mean"),
        )
        .sort_values("Monthly_Expenditure_USD", ascending=False)
    )
    return aggregated


def build_canonical_catalog(dataframe: pd.DataFrame) -> dict[str, Any]:
    geography_available = any(
        column.lower() in {"geography", "county", "countyname", "county_name", "district", "region", "subcounty", "subcountyname", "sub_county", "sub_county_name"}
        for column in dataframe.columns
    )

    return {
        "source": CSV_PATH.name,
        "table": TABLE_NAME,
        "row_count": int(len(dataframe)),
        "columns": list(dataframe.columns),
        "dimensions": [
            {"key": "Month", "label": "Month", "type": "time", "drilldown": True},
            {"key": "Facility", "label": "Facility", "type": "organization", "drilldown": True},
            {"key": "County", "label": "County", "type": "geo", "drilldown": geography_available, "available": geography_available},
            {"key": "SubCounty", "label": "Sub-County", "type": "geo", "drilldown": geography_available, "available": geography_available},
            {"key": "Indicator", "label": "Indicator", "type": "indicator", "drilldown": True},
            {"key": "Geography", "label": "Geography", "type": "geo", "drilldown": geography_available, "available": geography_available},
        ],
        "indicators": [
            {"key": "Total_Visits", "label": "Total Visits", "aggregation": "sum", "measure": "volume"},
            {"key": "Monthly_Expenditure_USD", "label": "Monthly Expenditure USD", "aggregation": "sum", "measure": "finance"},
            {"key": "Cost_Per_ANC_Visit", "label": "Cost Per ANC Visit", "aggregation": "avg", "measure": "efficiency"},
        ],
        "drilldown_keys": ["Month", "County", "SubCounty", "Facility", "Indicator"],
        "derived_metrics": [
            {"key": "visits_per_usd", "label": "Visits per USD", "formula": "SUM(Total_Visits) / SUM(Monthly_Expenditure_USD)"},
            {"key": "avg_cost_per_visit", "label": "Average Cost Per Visit", "formula": "SUM(Monthly_Expenditure_USD) / SUM(Total_Visits)"},
            {"key": "monthly_visit_growth", "label": "Monthly Visit Growth", "formula": "Current month total visits - previous month total visits"},
        ],
        "notes": [
            "DHIS analytics rows are enriched with facility names plus county and sub-county labels from organisation units before being merged into the live dashboard dataset.",
            "Hospitals.csv is used as a lookup table for human-readable facility names and is not merged as raw fact rows.",
            "All numeric summaries, rankings, and grouped rollups are computed locally before any AI call.",
        ],
    }


def build_facility_page(
    dataframe: pd.DataFrame,
    page: int = 1,
    page_size: int = 20,
    search: str = "",
    location_hierarchy: dict[str, Any] | None = None,
    hospitals_frame: pd.DataFrame | None = None,
    org_units_map: dict[str, dict[str, Any]] | None = None,
    hospital_map: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if location_hierarchy and location_hierarchy.get("facilities_by_subcounty"):
        rows: list[dict[str, Any]] = []
        facilities_by_subcounty = location_hierarchy.get("facilities_by_subcounty", {}) or {}
        for county, sub_map in facilities_by_subcounty.items():
            for subcounty, facilities in (sub_map or {}).items():
                for facility in facilities or []:
                    rows.append(
                        {
                            "Facility": facility,
                            "County": county,
                            "SubCounty": subcounty,
                            "Facility_ID": "",
                        }
                    )

        facility_frame = pd.DataFrame(rows)
        if search:
            facility_frame = facility_frame[facility_frame["Facility"].str.lower().str.contains(search, na=False)]

        total_rows = int(len(facility_frame))
        start = (page - 1) * page_size
        end = start + page_size
        page_frame = facility_frame.iloc[start:end].copy()

        return {
            "page": page,
            "page_size": page_size,
            "total_rows": total_rows,
            "rows": page_frame.to_dict(orient="records"),
            "has_more": end < total_rows,
        }

    if hospitals_frame is not None and not hospitals_frame.empty:
        facility_frame = hospitals_frame.copy()
        facility_frame["Facility"] = facility_frame.get("hospital_name", "").map(clean_text)
        facility_frame["Facility_ID"] = facility_frame.get("hospital_id", "").map(clean_text)

        org_units_map = org_units_map or {}
        hospital_map = hospital_map or {}
        if "hospital_id" in facility_frame.columns:
            context = facility_frame["hospital_id"].map(lambda unit_id: resolve_unit_context(unit_id, org_units_map, hospital_map))
            if "County" not in facility_frame.columns:
                facility_frame["County"] = context.map(lambda item: item["County"])
            if "SubCounty" not in facility_frame.columns:
                facility_frame["SubCounty"] = context.map(lambda item: item["SubCounty"])
            facility_frame["Facility"] = facility_frame["Facility"].where(facility_frame["Facility"].astype(str).str.strip() != "", context.map(lambda item: item["Facility"]))

        if search:
            facility_frame = facility_frame[facility_frame["Facility"].str.lower().str.contains(search, na=False)]

        total_rows = int(len(facility_frame))
        start = (page - 1) * page_size
        end = start + page_size
        page_frame = facility_frame.iloc[start:end].copy()

        return {
            "page": page,
            "page_size": page_size,
            "total_rows": total_rows,
            "rows": page_frame.to_dict(orient="records"),
            "has_more": end < total_rows,
        }

    facility_totals = aggregate_facility_metrics(dataframe).copy()
    if search:
        facility_totals = facility_totals[facility_totals["Facility"].str.lower().str.contains(search, na=False)]

    total_rows = int(len(facility_totals))
    start = (page - 1) * page_size
    end = start + page_size
    page_frame = facility_totals.iloc[start:end].copy()

    return {
        "page": page,
        "page_size": page_size,
        "total_rows": total_rows,
        "rows": page_frame.to_dict(orient="records"),
        "has_more": end < total_rows,
    }


def build_local_sql(question: str) -> str | None:
    normalized = re.sub(r"\s+", " ", question.lower()).strip()
    if not normalized:
        return None

    limit_match = re.search(r"\b(top|highest|first)\s+(\d+)\b", normalized)
    if limit_match:
        limit = int(limit_match.group(2))
    else:
        quantity_match = re.search(r"\b(\d+)\b", normalized)
        limit = int(quantity_match.group(1)) if quantity_match else 5

    spend_terms = ["monthly_expenditure_usd", "monthly expenditure", "budget", "cost", "spend"]
    visit_terms = ["total_visits", "visits", "volume", "attendance", "patients"]

    facility_scope_cte = (
        "WITH facility_scope AS ( "
        "SELECT Facility, Total_Visits, Monthly_Expenditure_USD, Cost_Per_ANC_Visit "
        "FROM clinics "
        "WHERE TRIM(COALESCE(Facility, '')) <> '' "
        "AND LOWER(TRIM(COALESCE(Facility, ''))) NOT IN ('kenya', 'unknown facility', 'national') "
        ") "
    )

    def ranked_facility_sql(order_column: str, order_direction: str, limit: int) -> str:
        return (
            facility_scope_cte
            + "SELECT Facility, "
            + "SUM(Total_Visits) AS Total_Visits, "
            + "ROUND(SUM(Monthly_Expenditure_USD), 2) AS Monthly_Expenditure_USD, "
            + "ROUND(AVG(Cost_Per_ANC_Visit), 2) AS Cost_Per_ANC_Visit "
            + "FROM facility_scope GROUP BY Facility "
            + f"ORDER BY {order_column} {order_direction} LIMIT {limit}"
        )

    if "month" in normalized or "trend" in normalized or "over time" in normalized:
        return (
            "SELECT Month, SUM(Total_Visits) AS total_visits, "
            "ROUND(SUM(Monthly_Expenditure_USD), 2) AS monthly_expenditure_usd, "
            "ROUND(AVG(Cost_Per_ANC_Visit), 2) AS avg_cost_per_anc_visit "
            "FROM clinics GROUP BY Month ORDER BY Month"
        )

    if any(token in normalized for token in spend_terms):
        order_direction = "ASC" if any(token in normalized for token in ["lowest", "least", "smallest", "bottom"]) else "DESC"
        return ranked_facility_sql("Monthly_Expenditure_USD", order_direction, limit)

    if any(token in normalized for token in visit_terms):
        order_direction = "ASC" if any(token in normalized for token in ["lowest", "least", "smallest", "bottom"]) else "DESC"
        return ranked_facility_sql("Total_Visits", order_direction, limit)

    if "average" in normalized or "avg" in normalized:
        if any(token in normalized for token in spend_terms):
            return "SELECT ROUND(AVG(Monthly_Expenditure_USD), 2) AS average_monthly_expenditure_usd FROM clinics"
        if any(token in normalized for token in visit_terms):
            return "SELECT ROUND(AVG(Total_Visits), 2) AS average_total_visits FROM clinics"

    if "total" in normalized or "sum" in normalized:
        if any(token in normalized for token in spend_terms):
            return "SELECT ROUND(SUM(Monthly_Expenditure_USD), 2) AS total_monthly_expenditure_usd FROM clinics"
        if any(token in normalized for token in visit_terms):
            return "SELECT SUM(Total_Visits) AS total_visits FROM clinics"

    if "clinic" in normalized or "facility" in normalized:
        return ranked_facility_sql("Monthly_Expenditure_USD", "DESC", limit)

    return None
