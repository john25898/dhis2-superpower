import os
import re
import time
import json
import io
import argparse
from urllib.parse import urlsplit, parse_qsl
import requests
from requests.auth import HTTPBasicAuth
import pandas as pd
from google import genai
from dotenv import load_dotenv

# 1. Load Environment Variables
load_dotenv()
BASE_URL = os.getenv("DHIS_BASE_URL")
USERNAME = os.getenv("DHIS_USERNAME")
PASSWORD = os.getenv("DHIS_PASSWORD")

def load_api_keys():
    """Load all configured Gemini API keys with stable ordering and deduplication."""
    keys = []

    primary = os.getenv("GEMINI_API_KEY")
    if primary:
        keys.append(primary)

    # Support numbered keys like GEMINI_API_KEY1, GEMINI_API_KEY2, ...
    numbered = []
    for env_name, env_val in os.environ.items():
        if not env_val:
            continue
        m = re.fullmatch(r"GEMINI_API_KEY(\d+)", env_name)
        if m:
            numbered.append((int(m.group(1)), env_val))
    for _, val in sorted(numbered, key=lambda x: x[0]):
        keys.append(val)

    backup = os.getenv("GEMINI_API_KEY_BACKUP")
    if backup:
        keys.append(backup)

    # Support comma-separated key list if provided.
    key_list = os.getenv("GEMINI_API_KEYS", "")
    if key_list:
        keys.extend([k.strip() for k in key_list.split(",") if k.strip()])

    # Include any remaining GEMINI_API_KEY* vars not captured above.
    for env_name, env_val in sorted(os.environ.items()):
        if env_name.startswith("GEMINI_API_KEY") and env_val:
            keys.append(env_val)

    deduped = []
    seen = set()
    for key in keys:
        if key not in seen:
            deduped.append(key)
            seen.add(key)
    return deduped


API_KEYS = load_api_keys()

_ELEMENTS_CACHE = None
_FACILITIES_CACHE = None
_ORG_UNITS_CACHE = None

# Special-case metric IDs for CHAK HTS_TST (Facility) - Index Testing block.
HTS_INDEX_POS_DX = "UO4pKx3APHd"  # HTS_INDEX Monthly - Contacts Tested - HIV+
HTS_INDEX_NEG_DX = "UMaMOVTYXOz"  # HTS_INDEX Monthly - Contacts Tested - HIV-

# Section metrics for HTS_TST (facility) - PITC Inpatient Services.
PITC_INPATIENT_DX = [
    "z26xAmE4oxt",  # Eligible
    "gJdTFjGIGQH",  # Screened
    "THJbtDzxplR",  # HIV Testing
    "X0Ihpq4XXJu",  # HIV Testing - HIV+
    "aSaZlpTvY7X",  # HIV Testing - HIV-
    "CafkDRu8dxj",  # Linked within
    "RexTMiW9ZoW",  # Linked outside Facility
    "ZoVxcULb7Cx",  # aPNS HIV Testing
    "jH3zAjfDmkL",  # aPNS HIV Testing - HIV+
    "mgS7yeJ1MR6",  # aPNS HIV Testing - HIV-
]


def load_dictionaries():
    """Load and cache dictionaries once per process."""
    global _ELEMENTS_CACHE, _FACILITIES_CACHE
    if _ELEMENTS_CACHE is not None and _FACILITIES_CACHE is not None:
        return _ELEMENTS_CACHE, _FACILITIES_CACHE

    df_elements = pd.read_csv("dictionaries/master_data_elements.csv")
    df_facilities = pd.read_csv("dictionaries/master_facilities.csv")

    for col in ["id", "name", "displayName", "shortName", "code", "description", "search_text"]:
        if col not in df_elements.columns:
            df_elements[col] = ""
        df_elements[col] = df_elements[col].fillna("").astype(str)

    for col in ["id", "name"]:
        if col not in df_facilities.columns:
            df_facilities[col] = ""
        df_facilities[col] = df_facilities[col].fillna("").astype(str)

    if "level" not in df_facilities.columns:
        df_facilities["level"] = ""
    df_facilities["level"] = df_facilities["level"].fillna("").astype(str)

    df_elements["search_blob"] = (
        df_elements["name"] + " | " +
        df_elements["displayName"] + " | " +
        df_elements["shortName"] + " | " +
        df_elements["code"] + " | " +
        df_elements["description"] + " | " +
        df_elements["search_text"]
    ).str.lower()

    df_facilities["search_blob"] = df_facilities["name"].str.lower()

    _ELEMENTS_CACHE = df_elements
    _FACILITIES_CACHE = df_facilities
    return _ELEMENTS_CACHE, _FACILITIES_CACHE


def load_org_units_tree():
    """Load the live DHIS org-unit tree once per process."""
    global _ORG_UNITS_CACHE
    if _ORG_UNITS_CACHE is not None:
        return _ORG_UNITS_CACHE

    url = f"{BASE_URL}organisationUnits.json?fields=id,name,level,path,parent[id,name]&paging=false"
    try:
        response = requests.get(url, auth=HTTPBasicAuth(USERNAME, PASSWORD), timeout=120)
        if response.status_code != 200:
            _ORG_UNITS_CACHE = pd.DataFrame(columns=["id", "name", "level", "path", "parent_id", "parent_name"])
            return _ORG_UNITS_CACHE
        data = response.json().get("organisationUnits", [])
        df = pd.DataFrame(data)
        if df.empty:
            _ORG_UNITS_CACHE = pd.DataFrame(columns=["id", "name", "level", "path", "parent_id", "parent_name"])
            return _ORG_UNITS_CACHE

        if "parent" in df.columns:
            df["parent_id"] = df["parent"].apply(lambda value: value.get("id") if isinstance(value, dict) else "")
            df["parent_name"] = df["parent"].apply(lambda value: value.get("name") if isinstance(value, dict) else "")
        else:
            df["parent_id"] = ""
            df["parent_name"] = ""

        for col in ["id", "name", "level", "path", "parent_id", "parent_name"]:
            if col not in df.columns:
                df[col] = ""
            df[col] = df[col].fillna("").astype(str)

        _ORG_UNITS_CACHE = df[["id", "name", "level", "path", "parent_id", "parent_name"]].copy()
        return _ORG_UNITS_CACHE
    except Exception:
        _ORG_UNITS_CACHE = pd.DataFrame(columns=["id", "name", "level", "path", "parent_id", "parent_name"])
        return _ORG_UNITS_CACHE


def extract_keywords(user_question):
    """Extract robust keywords including acronyms and underscore codes."""
    tokens = re.findall(r"\b[a-zA-Z0-9_]{2,}\b", user_question)
    ignore_words = {
        "this", "that", "with", "from", "total", "hospital", "cases", "case",
        "last", "months", "month", "confirmed", "show", "get", "give", "for",
        "the", "and", "in", "at", "of", "me", "please", "data", "numbers"
        ,"how", "many", "fetch", "quarter", "year", "current", "first", "second",
        "third", "fourth", "visit", "visits", "tests", "test"
        ,"what", "need", "were", "is", "are", "values", "value"
    }

    keywords = []
    for raw in tokens:
        token = raw.strip()
        lower = token.lower()
        if lower.endswith("s") and len(lower) > 4:
            lower = lower[:-1]
        if lower in ignore_words:
            continue
        if len(lower) <= 2 and "_" not in token and not any(c.isdigit() for c in token) and not token.isupper():
            continue
        keywords.append(lower if token.islower() else token)

    seen = set()
    deduped = []
    for kw in keywords:
        key = kw.lower()
        if key not in seen:
            deduped.append(kw)
            seen.add(key)
    return deduped


def split_metric_and_facility_text(user_question):
    """Split question into likely metric and facility segments."""
    q = user_question.strip()
    metric_text = q
    facility_text = ""

    facility_markers = ["county", "hospital", "subcounty", "sub-county", "facility", "mission", "clinic"]

    # Prefer 'in'/'at' because they most often introduce location context.
    m = re.search(r"\b(in|at)\b", q, flags=re.IGNORECASE)
    if m:
        metric_text = q[:m.start()].strip()
        facility_text = q[m.end():].strip()
    else:
        # Split on 'for' only when trailing segment looks like a location phrase.
        for_matches = list(re.finditer(r"\bfor\b", q, flags=re.IGNORECASE))
        for fm in for_matches:
            trailing = q[fm.end():].strip().lower()
            if any(marker in trailing for marker in facility_markers):
                metric_text = q[:fm.start()].strip()
                facility_text = q[fm.end():].strip()
                break

    # Remove trailing period phrases from facility segment.
    facility_text = re.sub(
        r"\b(last\s+\d+\s+months|last\s+month|this\s+month|this\s+year|last\s+year|this\s+quarter|last\s+quarter|\d{4})\b",
        " ",
        facility_text,
        flags=re.IGNORECASE,
    )
    facility_text = re.sub(r"\s+", " ", facility_text).strip()
    return metric_text, facility_text


def has_explicit_location_context(user_question):
    """Detect whether the prompt gives enough location context to search facilities."""
    q = (user_question or "").lower()
    _, facility_text = split_metric_and_facility_text(user_question)
    if facility_text.strip():
        return True
    return any(
        marker in q
        for marker in [" in ", " at ", "facility", "hospital", "clinic", "mission", "center", "centre"]
    )


def detect_metadata_list_intent(user_question):
    """Detect requests that are asking for lists of hospitals, counties, or facilities."""
    q = (user_question or "").lower()
    list_words = any(word in q for word in ["list", "show", "give", "all", "every", "extract"])
    metadata_words = any(word in q for word in ["hospital", "hospitals", "county", "counties", "facility", "facilities", "organisation unit", "org unit", "org units"])
    hierarchy_words = any(word in q for word in ["subcounty", "sub county", "subcounties", "ward", "wards"])
    return list_words and metadata_words and not hierarchy_words


def detect_geo_hierarchy_intent(user_question):
    """Detect hierarchy requests such as subcounties in a county or wards in a subcounty."""
    q = (user_question or "").lower()
    relation_words = any(word in q for word in ["subcounty", "sub county", "subcounties", "ward", "wards", "hospital", "hospitals", "facility", "facilities"])
    anchor_words = any(word in q for word in ["county", "subcounty", "sub county", "ward", "hospital", "facility"])
    return relation_words and anchor_words


def build_metadata_rows(user_question):
    """Build a list of metadata rows from the local DHIS-synced facility dictionary."""
    _, df_facilities = load_dictionaries()
    q = (user_question or "").lower()
    out = df_facilities.copy()

    if "county" in q:
        counties = out[
            (out["level"] == "2") |
            (out["name"].str.contains(r"\bcounty\b", case=False, regex=True))
        ]
        if not counties.empty:
            out = counties
    elif "hospital" in q:
        hospitals = out[out["name"].str.contains(r"hospital", case=False, regex=True)]
        if not hospitals.empty:
            out = hospitals
    elif "facility" in q or "organisation unit" in q or "org unit" in q or "org units" in q:
        # Keep all facilities.
        pass

    out = out.sort_values(by=["level", "name"], ascending=[True, True]).copy()
    out["type"] = out["name"].apply(lambda value: "County" if "county" in str(value).lower() else ("Hospital" if "hospital" in str(value).lower() else "Facility"))
    return out[["id", "name", "level", "type"]]


def _extract_anchor_text(user_question):
    """Take the text after the most likely relationship word as the anchor phrase."""
    q = (user_question or "").strip()
    match = re.search(r"\b(in|of|within|for)\b", q, flags=re.IGNORECASE)
    if match:
        return q[match.end():].strip()
    return q


def _extract_relation_text(user_question):
    """Take the text before the most likely relationship word as the requested child type."""
    q = (user_question or "").strip()
    match = re.search(r"\b(in|of|within|for)\b", q, flags=re.IGNORECASE)
    if match:
        return q[:match.start()].strip()
    return q


def _clean_label(value):
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def _org_unit_level_from_text(user_question):
    q = _extract_relation_text(user_question).lower()
    if "subcounties" in q or "subcounty" in q or "sub county" in q:
        return 3
    if "ward" in q or "wards" in q:
        return 4
    if "hospital" in q or "hospitals" in q or "facility" in q or "facilities" in q:
        return 5
    if "county" in q:
        return 2
    return None


def _find_best_org_unit_anchor(user_question):
    """Find the most likely anchor unit from the live org-unit tree."""
    org_units = load_org_units_tree()
    if org_units.empty:
        return None

    anchor_text = _clean_label(_extract_anchor_text(user_question))
    if not anchor_text:
        return None

    candidates = org_units.copy()
    candidates["name_lower"] = candidates["name"].apply(_clean_label)

    exact = candidates[candidates["name_lower"] == anchor_text]
    if not exact.empty:
        return exact.iloc[0].to_dict()

    contains = candidates[candidates["name_lower"].str.contains(re.escape(anchor_text), regex=True, na=False)]
    if contains.empty:
        return None

    contains = contains.copy()
    contains["name_len"] = contains["name_lower"].str.len()
    contains["level_num"] = pd.to_numeric(contains["level"], errors="coerce").fillna(99)
    contains = contains.sort_values(by=["level_num", "name_len"], ascending=[True, True])
    return contains.iloc[0].to_dict()


def _build_lineage_map(org_units):
    by_id = {str(row["id"]): row for _, row in org_units.iterrows()}
    lineage = {}
    for _, row in org_units.iterrows():
        path_ids = [part for part in str(row.get("path", "")).split("/") if part]
        county = subcounty = ward = ""
        for unit_id in path_ids:
            unit = by_id.get(unit_id)
            if unit is None:
                continue
            level_num = int(float(unit.get("level", 0) or 0))
            if level_num == 2:
                county = str(unit.get("name", ""))
            elif level_num == 3:
                subcounty = str(unit.get("name", ""))
            elif level_num == 4:
                ward = str(unit.get("name", ""))
        lineage[str(row["id"])] = {
            "county": county,
            "subcounty": subcounty,
            "ward": ward,
        }
    return lineage


def fetch_geo_hierarchy_result(user_question, export_csv=False):
    """Return county/subcounty/ward/facility hierarchy rows from live DHIS org units."""
    org_units = load_org_units_tree()
    if org_units.empty:
        return {"ok": False, "error": "Could not load live DHIS org-unit hierarchy.", "rows": [], "total": 0, "saved_path": None}

    target_level = _org_unit_level_from_text(user_question)
    anchor = _find_best_org_unit_anchor(user_question)
    if not anchor:
        return {"ok": False, "error": "Could not identify the base geography for that request.", "rows": [], "total": 0, "saved_path": None}

    anchor_id = str(anchor.get("id", ""))
    anchor_path = str(anchor.get("path", ""))
    anchor_level = int(float(anchor.get("level", 0) or 0))

    # Default the child level one step below the anchor when the request says "all ... in ...".
    if target_level is None:
        if anchor_level == 2:
            target_level = 3
        elif anchor_level == 3:
            target_level = 4
        else:
            target_level = 5

    lineage_map = _build_lineage_map(org_units)
    descendants = org_units[
        org_units["path"].astype(str).str.startswith(anchor_path, na=False)
    ].copy()
    descendants["level_num"] = pd.to_numeric(descendants["level"], errors="coerce").fillna(99).astype(int)
    descendants = descendants[descendants["level_num"] == target_level].copy()

    if descendants.empty:
        return {
            "ok": True,
            "rows": [],
            "total": 0,
            "saved_path": None,
            "message": f"No matching units found under {anchor.get('name', anchor_id)}.",
        }

    rows = []
    for _, row in descendants.sort_values(by=["name"], ascending=[True]).iterrows():
        line = lineage_map.get(str(row["id"]), {})
        rows.append({
            "id": str(row["id"]),
            "name": str(row["name"]),
            "level": str(row["level"]),
            "county": line.get("county", ""),
            "subcounty": line.get("subcounty", ""),
            "ward": line.get("ward", ""),
            "parent_name": str(row.get("parent_name", "")),
            "path": str(row.get("path", "")),
        })

    saved_path = None
    if export_csv and rows:
        saved_path = save_rows_to_csv(rows, user_question)

    return {
        "ok": True,
        "rows": rows,
        "total": len(rows),
        "saved_path": saved_path,
        "message": f"Returned {len(rows)} hierarchy rows.",
    }


def fetch_metadata_result(user_question, export_csv=False):
    """Return metadata listing results for hospitals/counties/facilities."""
    rows_df = build_metadata_rows(user_question)
    rows = rows_df.to_dict(orient="records")
    saved_path = None
    if export_csv and rows:
        saved_path = save_rows_to_csv(rows, user_question)
    return {
        "ok": True,
        "rows": rows,
        "total": len(rows),
        "saved_path": saved_path,
        "message": f"Returned {len(rows)} metadata rows.",
    }


def choose_relative_period(user_question):
    """Deterministic period parser to avoid model mistakes."""
    q = user_question.lower()

    # Exact monthly period code (YYYYMM) should be preserved.
    m_yyyymm = re.search(r"\b(20\d{2})(0[1-9]|1[0-2])\b", q)
    if m_yyyymm:
        return f"{m_yyyymm.group(1)}{m_yyyymm.group(2)}"

    # Natural language month + year, e.g. "March 2026" -> "202603"
    month_map = {
        "january": "01", "jan": "01",
        "february": "02", "feb": "02",
        "march": "03", "mar": "03",
        "april": "04", "apr": "04",
        "may": "05",
        "june": "06", "jun": "06",
        "july": "07", "jul": "07",
        "august": "08", "aug": "08",
        "september": "09", "sep": "09", "sept": "09",
        "october": "10", "oct": "10",
        "november": "11", "nov": "11",
        "december": "12", "dec": "12",
    }
    m_month_year = re.search(
        r"\b(" + "|".join(month_map.keys()) + r")\s+(20\d{2})\b",
        q,
    )
    if m_month_year:
        month_token = m_month_year.group(1)
        year_token = m_month_year.group(2)
        return f"{year_token}{month_map[month_token]}"

    # Also support "2026 March" format.
    m_year_month = re.search(
        r"\b(20\d{2})\s+(" + "|".join(month_map.keys()) + r")\b",
        q,
    )
    if m_year_month:
        year_token = m_year_month.group(1)
        month_token = m_year_month.group(2)
        return f"{year_token}{month_map[month_token]}"

    if re.search(r"last\s+6\s+months", q):
        return "LAST_6_MONTHS"
    if re.search(r"last\s+12\s+months|last\s+year", q):
        return "LAST_12_MONTHS"
    if "this year" in q or "current year" in q:
        return "THIS_YEAR"
    if "last month" in q:
        return "LAST_MONTH"
    if "this month" in q or "current month" in q:
        return "THIS_MONTH"
    if "last quarter" in q:
        return "LAST_QUARTER"
    if "this quarter" in q or "current quarter" in q:
        return "THIS_QUARTER"
    m = re.search(r"(20\d{2})", q)
    if m:
        return m.group(1)
    return "LAST_6_MONTHS"


def reduce_records_for_prompt(df, columns, max_chars=6000):
    """Greedy context reducer: include compact records up to a strict char budget."""
    records = []
    used = 2
    for _, row in df.iterrows():
        item = {col: str(row.get(col, "")) for col in columns}
        as_json = json.dumps(item, ensure_ascii=True)
        projected = used + len(as_json) + (1 if records else 0)
        if projected > max_chars:
            break
        records.append(item)
        used = projected
    return json.dumps(records, ensure_ascii=True)


def score_elements(df_elements, keywords, metric_text=""):
    out = df_elements.copy()
    out["score"] = 0
    out["code_upper"] = out["code"].str.upper()

    for kw in keywords:
        kw_lower = kw.lower()
        kw_upper = kw.upper()

        exact_code = out["code_upper"] == kw_upper
        exact_name = out["name"].str.lower() == kw_lower
        in_name = out["name"].str.lower().str.contains(re.escape(kw_lower), regex=True)
        in_blob = out["search_blob"].str.contains(re.escape(kw_lower), regex=True)

        out.loc[exact_code, "score"] += 25
        out.loc[exact_name, "score"] += 15
        out.loc[in_name, "score"] += 7
        out.loc[in_blob, "score"] += 3

    metric_text_l = metric_text.lower()
    name_l = out["name"].str.lower()

    if "number tested" in metric_text_l:
        out.loc[name_l.str.contains(r"number\s+tested", regex=True), "score"] += 12
        if "negative" not in metric_text_l and "positive" not in metric_text_l:
            out.loc[name_l.str.contains("negative", regex=False), "score"] -= 8
            out.loc[name_l.str.contains("positive", regex=False), "score"] -= 8
    if "tested negative" in metric_text_l or "negative" in metric_text_l:
        out.loc[name_l.str.contains("negative", regex=False), "score"] += 10
    if "tested positive" in metric_text_l or "positive" in metric_text_l:
        out.loc[name_l.str.contains("positive", regex=False), "score"] += 10
    if "self" in metric_text_l and ("test" in metric_text_l or "testing" in metric_text_l):
        out.loc[name_l.str.contains("hiv_st", regex=False), "score"] += 12
        out.loc[name_l.str.contains("hiv_self", regex=False), "score"] += 10
        out.loc[name_l.str.contains("self", regex=False), "score"] += 4
    if "unassisted" in metric_text_l and "kits" in metric_text_l:
        out.loc[name_l.str.contains("kits distributed", regex=False), "score"] += 10
        out.loc[name_l.str.contains("unassisted", regex=False), "score"] += 6
    if "3hp" not in metric_text_l:
        out.loc[name_l.str.contains("3hp", regex=False), "score"] -= 10

    out = out[out["score"] > 0].sort_values(by=["score", "name"], ascending=[False, True])
    return out.drop(columns=["code_upper"])


def score_facilities(df_facilities, keywords):
    out = df_facilities.copy()
    out["score"] = 0
    out["name_lower"] = out["name"].str.lower()

    for kw in keywords:
        kw_lower = kw.lower()
        in_name = out["name_lower"].str.contains(re.escape(kw_lower), regex=True)
        out.loc[in_name, "score"] += 6

    out.loc[out["level"] == "5", "score"] += 2
    out = out[out["score"] > 0].sort_values(by=["score", "name"], ascending=[False, True])
    return out.drop(columns=["name_lower"])

def get_relevant_matches(user_question):
    """Filters the massive CSVs using a Keyword Scoring Algorithm."""
    print("[SEARCH] Searching local dictionaries for keywords...")
    
    try:
        df_elements, df_facilities = load_dictionaries()
    except Exception as e:
        print("[ERROR] Could not find CSVs in the 'dictionaries' folder.")
        return None, None

    keywords = extract_keywords(user_question)
    metric_text, facility_text = split_metric_and_facility_text(user_question)
    metric_keywords = extract_keywords(metric_text) or keywords
    facility_context = has_explicit_location_context(user_question)
    facility_keywords = extract_keywords(facility_text) if facility_context else []
    if facility_context and not facility_keywords:
        facility_keywords = keywords
    
    print(f"   -> Extracted Search Keywords: {keywords}")
    print(f"   -> Metric Keywords: {metric_keywords}")
    print(f"   -> Facility Keywords: {facility_keywords}")
    
    if not keywords:
        return "[]", "[]"

    matched_elements = score_elements(df_elements, metric_keywords, metric_text=metric_text)
    matched_facilities = score_facilities(df_facilities, facility_keywords) if facility_keywords else df_facilities.head(0)

    print(f"   -> Found {len(matched_elements)} Data Elements. (Top Score: {matched_elements['score'].max() if not matched_elements.empty else 0})")
    print(f"   -> Found {len(matched_facilities)} Facilities. (Top Score: {matched_facilities['score'].max() if not matched_facilities.empty else 0})")

    top_elements = matched_elements.head(25)
    top_facilities = matched_facilities.head(25)

    # Mathematical context reduction: keep only minimal fields and hard char budgets.
    elements_json = reduce_records_for_prompt(top_elements, ["id", "name", "code", "type", "score"], max_chars=7000)
    facilities_json = reduce_records_for_prompt(top_facilities, ["id", "name", "level", "score"], max_chars=5000)
    
    return elements_json, facilities_json


def extract_dims_from_url(url):
    """Parse dx/ou/pe from generated URL query parameters."""
    try:
        parsed = urlsplit(url)
        pairs = parse_qsl(parsed.query, keep_blank_values=True)
    except Exception:
        return None, None, None

    dx = ou = pe = None
    for k, v in pairs:
        if k == "dimension" and ":" in v:
            dim_key, dim_val = v.split(":", 1)
            if dim_key == "dx":
                dx = dim_val
            elif dim_key == "ou":
                ou = dim_val
            elif dim_key == "pe":
                pe = dim_val
    return dx, ou, pe


def parse_dimensions(url):
    """Parse all dimension values from URL."""
    try:
        parsed = urlsplit(url)
        pairs = parse_qsl(parsed.query, keep_blank_values=True)
    except Exception:
        return []
    return [v for k, v in pairs if k == "dimension"]


def build_url_from_dimensions(dimensions):
    """Build analytics URL from ordered dimension strings."""
    if not dimensions:
        return None
    joined = "&".join([f"dimension={d}" for d in dimensions])
    return f"{BASE_URL}analytics.json?{joined}"


def get_element_name_by_id(dx_id):
    """Lookup element name by id from cached dictionary."""
    try:
        df_elements, _ = load_dictionaries()
    except Exception:
        return None
    hit = df_elements[df_elements["id"].astype(str) == str(dx_id)]
    if hit.empty:
        return None
    return str(hit.iloc[0]["name"])


def get_section_dx_ids(dx_id):
    """Find sibling metrics in same section by dropping final ' - ...' segment."""
    try:
        df_elements, _ = load_dictionaries()
    except Exception:
        return None

    name = get_element_name_by_id(dx_id)
    if not name or " - " not in name:
        return None

    section_prefix = name.rsplit(" - ", 1)[0]
    siblings = df_elements[
        df_elements["name"].astype(str).str.startswith(section_prefix + " - ", na=False)
    ]
    if siblings.empty:
        return None

    if len(siblings) < 2 or len(siblings) > 20:
        return None

    return siblings["id"].astype(str).tolist()


def expand_url_to_section(url):
    """If URL targets a single dx that belongs to a section, expand to all rows."""
    dims = parse_dimensions(url)
    if not dims:
        return url

    dx_idx = next((i for i, d in enumerate(dims) if d.startswith("dx:")), -1)
    if dx_idx == -1:
        return url

    dx_vals = dims[dx_idx].split(":", 1)[1].strip()
    if ";" in dx_vals:
        return url

    section_ids = get_section_dx_ids(dx_vals)
    if not section_ids:
        return url

    dims[dx_idx] = "dx:" + ";".join(section_ids)
    expanded = build_url_from_dimensions(dims)
    return expanded or url


def resolve_facility_uid(user_question):
    """Resolve best facility UID from free text question."""
    try:
        _, df_facilities = load_dictionaries()
    except Exception:
        return None

    q = user_question.lower()
    if not has_explicit_location_context(user_question):
        return None

    _, facility_text = split_metric_and_facility_text(user_question)

    # Strong preference: exact facility-name mention in prompt text.
    direct = df_facilities[
        df_facilities["name"].astype(str).str.lower().apply(lambda n: bool(n) and n in q)
    ]
    if not direct.empty:
        # Prefer deepest org unit level (facility-level) and longest textual match.
        direct = direct.copy()
        direct["name_len"] = direct["name"].astype(str).str.len()
        direct = direct.sort_values(by=["level", "name_len"], ascending=[False, False])
        return str(direct.iloc[0]["id"])

    facility_keywords = extract_keywords(facility_text) or extract_keywords(user_question)
    if not facility_keywords:
        return None

    matched_facilities = score_facilities(df_facilities, facility_keywords)
    if matched_facilities.empty:
        return None
    return str(matched_facilities.iloc[0]["id"])


def detect_index_testing_intent(user_question):
    """Detect HTS_TST facility index-testing intent from varied wording."""
    q = user_question.lower()
    has_index_phrase = (
        "index testing" in q or
        "index case" in q or
        "new positives" in q or
        "new negatives" in q or
        "sub-total" in q or
        "subtotal" in q
    )
    has_hts_context = ("hts_tst" in q or "hts tst" in q or "hiv prevention and testing" in q)
    return has_index_phrase and has_hts_context


def build_index_testing_url(user_question):
    """Build composite URL for HTS_TST facility index testing (HIV+ and HIV-)."""
    ou = resolve_facility_uid(user_question)
    if not ou:
        return None
    pe = choose_relative_period(user_question)
    return (
        f"{BASE_URL}analytics.json?"
        f"dimension=dx:{HTS_INDEX_POS_DX};{HTS_INDEX_NEG_DX}&"
        f"dimension=ou:{ou}&dimension=pe:{pe}"
    )


def detect_pitc_inpatient_intent(user_question):
    """Detect PITC Inpatient Services section request from varied wording."""
    q = user_question.lower()
    return (
        "pitc inpatient" in q and
        ("hts_tst" in q or "hts tst" in q or "hiv testing" in q)
    )


def build_pitc_inpatient_url(user_question):
    """Build composite URL for PITC Inpatient Services section metrics."""
    ou = resolve_facility_uid(user_question)
    if not ou:
        return None
    pe = choose_relative_period(user_question)
    dx_joined = ";".join(PITC_INPATIENT_DX)
    return (
        f"{BASE_URL}analytics.json?"
        f"dimension=dx:{dx_joined}&dimension=ou:{ou}&dimension=pe:{pe}"
    )


def validate_dims(dx, ou, pe, elements_json, facilities_json):
    """Accept only known IDs to prevent invalid DHIS2 requests."""
    if not dx or not ou or not pe:
        return False

    try:
        el = pd.read_json(io.StringIO(elements_json))
        fa = pd.read_json(io.StringIO(facilities_json))
    except Exception:
        return False

    valid_dx = set(el.get("id", pd.Series(dtype=str)).astype(str).tolist())
    valid_ou = set(fa.get("id", pd.Series(dtype=str)).astype(str).tolist())

    return dx in valid_dx and ou in valid_ou


def fallback_build_url(user_question, elements_json, facilities_json):
    """Deterministic fallback when model output is invalid or empty."""
    try:
        el = pd.read_json(io.StringIO(elements_json))
        fa = pd.read_json(io.StringIO(facilities_json))
    except Exception:
        return None

    if el.empty or fa.empty:
        return None

    period = choose_relative_period(user_question)
    dx = str(el.iloc[0]["id"])
    ou = str(fa.iloc[0]["id"])
    return f"{BASE_URL}analytics.json?dimension=dx:{dx}&dimension=ou:{ou}&dimension=pe:{period}"


def fetch_analytics_total(dx, ou, pe):
    """Fetch summed analytics total for a candidate tuple; returns None on errors."""
    url = f"{BASE_URL}analytics.json?dimension=dx:{dx}&dimension=ou:{ou}&dimension=pe:{pe}"
    try:
        response = requests.get(url, auth=HTTPBasicAuth(USERNAME, PASSWORD), timeout=20)
        if response.status_code != 200:
            return None
        data = response.json()
        rows = data.get("rows", [])
        headers = data.get("headers", [])
        val_idx = next((i for i, h in enumerate(headers) if h.get("name") == "value"), -1)
        if val_idx == -1:
            return 0.0
        total = 0.0
        for row in rows:
            try:
                total += float(row[val_idx])
            except Exception:
                continue
        return total
    except Exception:
        return None


def rerank_dx_with_live_data(elements_json, chosen_ou, chosen_pe, metric_text="", limit=20):
    """Use live DHIS totals to prefer candidates with non-zero observed values."""
    try:
        el = pd.read_json(io.StringIO(elements_json))
    except Exception:
        return None

    if el.empty:
        return None

    candidates = el.head(limit).copy()
    metric_text_l = metric_text.lower()
    name_l = candidates["name"].astype(str).str.lower()

    def apply_filter(mask):
        nonlocal candidates, name_l
        filtered = candidates[mask]
        if not filtered.empty:
            candidates = filtered
            name_l = candidates["name"].astype(str).str.lower()

    if "number tested" in metric_text_l:
        apply_filter(name_l.str.contains(r"number\s+tested", regex=True))
    if "tested negative" in metric_text_l or " negative" in f" {metric_text_l}":
        apply_filter(name_l.str.contains("negative", regex=False))
    if "tested positive" in metric_text_l or " positive" in f" {metric_text_l}":
        apply_filter(name_l.str.contains("positive", regex=False))
    if "sexual partner" in metric_text_l:
        apply_filter(name_l.str.contains("sexual partner", regex=False))
    if "unassisted" in metric_text_l and "kits" in metric_text_l:
        apply_filter(name_l.str.contains("unassisted", regex=False))

    # Align to explicit section words in prompt to avoid wrong HTS_TST block selection.
    section_terms = [
        "inpatient", "pediatric", "malnutrition", "tb clinic", "sti clinic",
        "vct", "emergency", "other pitc", "index", "anc", "pnc", "l&d"
    ]
    for term in section_terms:
        if term in metric_text_l:
            apply_filter(name_l.str.contains(re.escape(term), regex=True))

    best_dx = None
    best_score = -1.0

    for _, row in candidates.iterrows():
        dx = str(row.get("id", "")).strip()
        if not dx:
            continue
        base_score = float(row.get("score", 0))
        live_total = fetch_analytics_total(dx, chosen_ou, chosen_pe)
        if live_total is None:
            continue
        # Reward actual data presence while keeping lexical score dominant.
        score = base_score + (50.0 if live_total > 0 else 0.0) + min(live_total / 200.0, 5.0)
        if score > best_score:
            best_score = score
            best_dx = dx

    return best_dx

def generate_dhis2_url(user_question):
    """Uses Gemini to translate English into a DHIS2 Analytics URL."""
    if detect_pitc_inpatient_intent(user_question):
        special_url = build_pitc_inpatient_url(user_question)
        if special_url:
            print("[ROUTE] PITC Inpatient Services special handler (full section rows).")
            print(f"[OK] URL Generated: {special_url}")
            return special_url

    if detect_index_testing_intent(user_question):
        special_url = build_index_testing_url(user_question)
        if special_url:
            print("[ROUTE] HTS Index Testing special handler (HIV+ and HIV- with subtotal).")
            print(f"[OK] URL Generated: {special_url}")
            return special_url

    elements_json, facilities_json = get_relevant_matches(user_question)
    
    if not elements_json:
        return None

    if elements_json == "[]" or facilities_json == "[]":
        print("[WARN] Not enough matches found in dictionaries. Please be more specific.")
        return None

    if not API_KEYS:
        print("[WARN] No Gemini API keys found. Using deterministic fallback URL builder.")
        return fallback_build_url(user_question, elements_json, facilities_json)

    # --- X-RAY DEBUG: See what the AI is choosing from ---
    print("\n[DEBUG] Top 5 Data Elements handed to the AI (X-Ray Debug):")
    try:
        top_elements = pd.read_json(io.StringIO(elements_json))
        for idx, row in top_elements.head(5).iterrows():
            print(f"   - {row['name']} (UID: {row.get('id', 'N/A')})")
    except Exception:
        print("   - (Could not parse JSON for debug view)")
    print("-" * 50)
    # -----------------------------------------------------

    prompt = f"""
    You are a Senior Data Engineer translating natural language into DHIS2 API URLs.
    
    BASE URL: {BASE_URL}analytics.json?
    
    RULES:
    1. Extract the requested data metric, the facility name, and the time period from the question.
     2. Choose ONLY from the provided dictionaries. Never invent IDs.
     3. For metric, choose an id from 'Data Elements Dictionary' (dimension=dx).
     4. For facility, choose an id from 'Facilities Dictionary' (dimension=ou).
     5. Convert time period into a DHIS2 relative period (dimension=pe).
     6. If period is ambiguous, use LAST_6_MONTHS.
    5. Construct the final URL using this format: 
       [BASE_URL]dimension=dx:[UID]&dimension=ou:[UID]&dimension=pe:[PERIOD]
     6. RETURN ONLY THE RAW URL. No markdown, no backticks, no extra text.

    RELEVANT DATA ELEMENTS:
    {elements_json}

    RELEVANT FACILITIES:
    {facilities_json}

    USER QUESTION:
    "{user_question}"
    """

    print("[AI] AI is translating the filtered data into a URL...")
    max_retries = 3
    
    for key_index, current_key in enumerate(API_KEYS):
        try:
            client = genai.Client(api_key=current_key)
        except Exception:
            continue

        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt
                )
                final_url = (response.text or "").strip()
                dx, ou, pe = extract_dims_from_url(final_url)
                if not validate_dims(dx, ou, pe, elements_json, facilities_json):
                    print("[WARN] Model returned invalid or hallucinated IDs. Using deterministic fallback.")
                    fallback = fallback_build_url(user_question, elements_json, facilities_json)
                    if fallback:
                        fdx, fou, fpe = extract_dims_from_url(fallback)
                        better_dx = rerank_dx_with_live_data(elements_json, fou, fpe, metric_text=user_question)
                        if better_dx:
                            fallback = f"{BASE_URL}analytics.json?dimension=dx:{better_dx}&dimension=ou:{fou}&dimension=pe:{fpe}"
                        fallback = expand_url_to_section(fallback)
                        print(f"[OK] URL Generated (fallback): {fallback}")
                        return fallback
                    return None

                better_dx = rerank_dx_with_live_data(elements_json, ou, pe, metric_text=user_question)
                if better_dx and better_dx != dx:
                    final_url = f"{BASE_URL}analytics.json?dimension=dx:{better_dx}&dimension=ou:{ou}&dimension=pe:{pe}"
                final_url = expand_url_to_section(final_url)
                print(f"[OK] URL Generated: {final_url}")
                return final_url
                
            except Exception as e:
                error_msg = str(e)
                if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                    print(f"[WARN] Key {key_index + 1} quota exceeded. Failing over to next key...")
                    break 
                elif "503" in error_msg or "UNAVAILABLE" in error_msg:
                    print(f"[WARN] Google servers are busy. Waiting 5 seconds...")
                    time.sleep(5)
                else:
                    break 

    print("[WARN] Model call failed across keys/attempts. Using deterministic fallback.")
    fallback = fallback_build_url(user_question, elements_json, facilities_json)
    if not fallback:
        return None
    fdx, fou, fpe = extract_dims_from_url(fallback)
    better_dx = rerank_dx_with_live_data(elements_json, fou, fpe, metric_text=user_question)
    if better_dx:
        fallback = f"{BASE_URL}analytics.json?dimension=dx:{better_dx}&dimension=ou:{fou}&dimension=pe:{fpe}"
    return expand_url_to_section(fallback)

def wants_csv_export(user_question):
    """Only export when user explicitly asks for CSV."""
    q = (user_question or "").lower()
    has_csv_word = "csv" in q
    has_export_intent = any(
        phrase in q
        for phrase in ["save", "export", "download", "as csv", "to csv"]
    )
    return has_csv_word and has_export_intent


def build_csv_filename(user_question):
    """Build a stable, readable CSV filename from the question."""
    base_tokens = extract_keywords(user_question)[:6]
    base = "_".join([re.sub(r"[^a-zA-Z0-9_]+", "", t) for t in base_tokens if t])
    base = base or "dhis_table"
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    return f"{base}_{timestamp}.csv"


def save_rows_to_csv(rows, user_question):
    """Persist query result rows to exports/ CSV."""
    if not rows:
        print("[INFO] CSV export skipped: there are no rows to save.")
        return None
    os.makedirs("exports", exist_ok=True)
    filename = build_csv_filename(user_question)
    path = os.path.join("exports", filename)
    pd.DataFrame(rows).to_csv(path, index=False)
    return path


def fetch_query_result(api_url, export_csv=False, user_question=""):
    """Fetch DHIS2 analytics data and return a structured result for CLI or UI use."""
    try:
        response = requests.get(api_url, auth=HTTPBasicAuth(USERNAME, PASSWORD), timeout=45)

        if response.status_code != 200:
            return {
                "ok": False,
                "error": f"Server Error {response.status_code}: {response.text}",
                "rows": [],
                "total": 0,
                "saved_path": None,
            }

        data = response.json()
        rows = data.get("rows", [])

        if not rows:
            return {
                "ok": True,
                "message": "The server understood the request, but returned NO DATA (0 cases) for this specific metric and timeframe.",
                "rows": [],
                "total": 0,
                "saved_path": None,
            }

        metadata = data.get("metaData", {}).get("items", {})
        headers = data.get("headers", [])

        dx_idx = next((i for i, h in enumerate(headers) if h["name"] == "dx"), -1)
        ou_idx = next((i for i, h in enumerate(headers) if h["name"] == "ou"), -1)
        pe_idx = next((i for i, h in enumerate(headers) if h["name"] == "pe"), -1)
        val_idx = next((i for i, h in enumerate(headers) if h["name"] == "value"), -1)

        total_sum = 0.0
        export_rows = []
        display_rows = []

        for row in rows:
            value = float(row[val_idx])
            total_sum += value

            dx_name = metadata.get(row[dx_idx], {}).get("name", row[dx_idx]) if dx_idx != -1 else "Metric"
            ou_name = metadata.get(row[ou_idx], {}).get("name", row[ou_idx]) if ou_idx != -1 else "Facility"
            pe_name = metadata.get(row[pe_idx], {}).get("name", row[pe_idx]) if pe_idx != -1 else "Period"

            item = {
                "period": pe_name,
                "metric": dx_name,
                "facility": ou_name,
                "value": int(value),
            }
            display_rows.append(item)
            export_rows.append(item)

        saved_path = None
        if export_csv:
            saved_path = save_rows_to_csv(export_rows, user_question)

        return {
            "ok": True,
            "rows": display_rows,
            "total": int(total_sum),
            "saved_path": saved_path,
        }

    except Exception as e:
        return {
            "ok": False,
            "error": f"Data Fetch Error: {e}",
            "rows": [],
            "total": 0,
            "saved_path": None,
        }


def fetch_and_clean_data(api_url, export_csv=False, user_question=""):
    """Pings the DHIS2 server, extracts the numbers, and prints a summary."""
    print("\n🚀 Pinging the CHAK DHIS2 Server for actual data...")
    result = fetch_query_result(api_url, export_csv=export_csv, user_question=user_question)
    if not result["ok"]:
        print(f"🚨 {result['error']}")
        return False

    if not result["rows"]:
        print(f"⚠️ {result['message']}")
        if export_csv:
            print("[INFO] CSV export skipped because query returned no rows.")
        return True

    print("\n📊 DATA RESULTS:")
    print("-" * 60)
    for row in result["rows"]:
        print(f" • {row['period']}: {row['value']} cases ({row['metric']} @ {row['facility']})")

    print("-" * 60)
    print(f"🎯 GRAND TOTAL: {result['total']}")
    print("-" * 60)

    if export_csv and result["saved_path"]:
        print(f"💾 CSV saved: {result['saved_path']}")

    return True


def run_single_question(question, force_csv=False):
    print(f"User: {question}\n")
    export_csv = force_csv or wants_csv_export(question)
    if export_csv:
        print("📝 Explicit CSV export requested. Results will be saved to exports/.")

    if detect_geo_hierarchy_intent(question):
        print("🗺️ Routed to geography hierarchy mode.")
        result = fetch_geo_hierarchy_result(question, export_csv=export_csv)
        if not result["ok"]:
            print(f"⚠️ {result['error']}")
            return False
        if not result["rows"]:
            print(f"⚠️ {result['message']}")
            return True
        print("\n📊 HIERARCHY RESULTS:")
        print("-" * 60)
        for row in result["rows"][:200]:
            print(f" • {row['name']} (level {row['level']}) | county={row['county']} | subcounty={row['subcounty']} | ward={row['ward']}")
        if len(result["rows"]) > 200:
            print(f" • ... and {len(result['rows']) - 200} more")
        print("-" * 60)
        print(f"🎯 TOTAL ROWS: {result['total']}")
        print("-" * 60)
        if result["saved_path"]:
            print(f"💾 CSV saved: {result['saved_path']}")
        return True

    if detect_metadata_list_intent(question):
        print("📚 Routed to metadata list mode.")
        result = fetch_metadata_result(question, export_csv=export_csv)
        if not result["rows"]:
            print("⚠️ No matching metadata rows found.")
            return True
        print("\n📊 METADATA RESULTS:")
        print("-" * 60)
        for row in result["rows"][:200]:
            print(f" • {row['name']} ({row['type']}, level {row['level']}) [{row['id']}]")
        if len(result["rows"]) > 200:
            print(f" • ... and {len(result['rows']) - 200} more")
        print("-" * 60)
        print(f"🎯 TOTAL ROWS: {result['total']}")
        print("-" * 60)
        if result["saved_path"]:
            print(f"💾 CSV saved: {result['saved_path']}")
        return True

    url = generate_dhis2_url(question)
    if not url:
        print("🚨 Could not generate a valid URL.")
        return False
    return fetch_and_clean_data(url, export_csv=export_csv, user_question=question)


def parse_args():
    parser = argparse.ArgumentParser(description="Translate plain English to DHIS2 analytics query.")
    parser.add_argument("-q", "--question", type=str, help="Natural language DHIS2 query")
    parser.add_argument("--csv", action="store_true", help="Explicitly save returned table to CSV")
    return parser.parse_args()

if __name__ == "__main__":
    print("=" * 60)
    print("🦸‍♂️ DHIS2 AI SUPERPOWER ACTIVATED")
    print("=" * 60)

    args = parse_args()
    question = args.question or "Get me the HTS_TST_POS for Nkubu Mission Hospital for the last 6 months."
    run_single_question(question, force_csv=args.csv)