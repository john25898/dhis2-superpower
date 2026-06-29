from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv


# Load .env if present so CLI can pick up credentials from the repo
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = BASE_DIR / "data" / "dhis"

# Keep keywords aligned with load_datim_hiv_treatment_sections() in app.py
HIV_TREATMENT_SECTION_EXPORTS: list[dict[str, Any]] = [
    {
        "label": "Newly Started on ART",
        "slug": "hiv_newly_started_art",
        "keywords": ["newly started on art", "new started on art", "sum of tbart new", "start on art"],
        # DHIS metadata uses MER codes (TX_NEW, etc.) rather than DATIM workbook phrasing.
        "export_keywords": ["tx_new", "new on art", "starting art"],
        "sources": ["indicators", "dataElements"],
    },
]

ANALYTICS_BATCH_SIZE = 40


class DhisExportError(RuntimeError):
    pass


def get_env(name: str, default: str = "") -> str:
    value = os.getenv(name, default).strip()
    return value


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    return session


def get_connection_settings(args: argparse.Namespace) -> dict[str, str]:
    return {
        "base_url": (args.base_url or get_env("DHIS_BASE_URL") or get_env("DHIS_URL") or get_env("DHIS2_BASE_URL") or "").rstrip("/"),
        "username": args.username or get_env("DHIS_USERNAME") or get_env("DHIS_USER") or "",
        "password": args.password or get_env("DHIS_PASSWORD") or get_env("DHIS_PASS") or "",
        "org_unit": args.org_unit or get_env("DHIS_ORG_UNIT") or get_env("DHIS_ORGUNIT") or "",
    }


def ensure_output_dirs(output_dir: Path) -> dict[str, Path]:
    raw_dir = output_dir / "raw"
    processed_dir = output_dir / "processed"
    meta_dir = output_dir / "meta"
    for folder in (raw_dir, processed_dir, meta_dir):
        folder.mkdir(parents=True, exist_ok=True)
    return {"raw": raw_dir, "processed": processed_dir, "meta": meta_dir}


def auth_for(settings: dict[str, str]) -> HTTPBasicAuth | None:
    if settings["username"] and settings["password"]:
        return HTTPBasicAuth(settings["username"], settings["password"])
    return None


def raise_for_dhis(response: requests.Response, context: str) -> None:
    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        message = response.text[:1000]
        raise DhisExportError(f"{context} failed: HTTP {response.status_code}. {message}") from exc


def fetch_json(session: requests.Session, url: str, auth: HTTPBasicAuth | None, params: dict[str, Any] | None = None) -> dict[str, Any]:
    response = session.get(url, auth=auth, params=params, timeout=90)
    raise_for_dhis(response, url)
    return response.json()


def export_metadata(session: requests.Session, settings: dict[str, str], output_dir: Path) -> dict[str, Path]:
    auth = auth_for(settings)
    base_url = settings["base_url"]
    if not base_url:
        raise DhisExportError("Missing DHIS base URL. Set DHIS_BASE_URL in your environment.")

    results: dict[str, Path] = {}

    data_elements = fetch_json(
        session,
        f"{base_url}/api/dataElements.json",
        auth,
        {"fields": "id,name,code,valueType,aggregationType", "paging": "false", "pageSize": 5000},
    )
    pd.DataFrame(data_elements.get("dataElements", [])).to_csv(output_dir / "meta" / "data_elements.csv", index=False)
    results["data_elements"] = output_dir / "meta" / "data_elements.csv"

    indicators = fetch_json(
        session,
        f"{base_url}/api/indicators.json",
        auth,
        {"fields": "id,name,code,numerator,denominator", "paging": "false", "pageSize": 5000},
    )
    pd.DataFrame(indicators.get("indicators", [])).to_csv(output_dir / "meta" / "indicators.csv", index=False)
    results["indicators"] = output_dir / "meta" / "indicators.csv"

    org_units = fetch_json(
        session,
        f"{base_url}/api/organisationUnits.json",
        auth,
        {"fields": "id,name,level,path,openingDate,closedDate,parent[id,name]", "paging": "false", "pageSize": 5000},
    )
    pd.DataFrame(org_units.get("organisationUnits", [])).to_csv(output_dir / "meta" / "organisation_units.csv", index=False)
    results["organisation_units"] = output_dir / "meta" / "organisation_units.csv"

    return results


def discover_metadata(session: requests.Session, settings: dict[str, str]) -> dict[str, list[dict[str, Any]]]:
    auth = auth_for(settings)
    base_url = settings["base_url"]
    if not base_url:
        raise DhisExportError("Missing DHIS base URL. Set DHIS_BASE_URL in your environment.")

    data_elements = fetch_json(
        session,
        f"{base_url}/api/dataElements.json",
        auth,
        {"fields": "id,name,code", "paging": "false", "pageSize": 5000},
    ).get("dataElements", [])
    indicators = fetch_json(
        session,
        f"{base_url}/api/indicators.json",
        auth,
        {"fields": "id,name,code", "paging": "false", "pageSize": 5000},
    ).get("indicators", [])

    return {"dataElements": data_elements, "indicators": indicators}


def pick_first_match(items: list[dict[str, Any]], keywords: list[str]) -> dict[str, Any] | None:
    lowered_keywords = [keyword.lower() for keyword in keywords]
    for item in items:
        text = f"{item.get('name', '')} {item.get('code', '')}".lower()
        if any(keyword in text for keyword in lowered_keywords):
            return item
    return items[0] if items else None


def pick_all_matches(
    items: list[dict[str, Any]],
    keywords: list[str],
    *,
    max_matches: int = 100,
) -> list[dict[str, Any]]:
    """Return all metadata items whose name/code contains any keyword."""
    lowered_keywords = [keyword.lower() for keyword in keywords if keyword.strip()]
    matches: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for item in items:
        item_id = str(item.get("id", "")).strip()
        if not item_id or item_id in seen_ids:
            continue
        text = f"{item.get('name', '')} {item.get('code', '')}".lower()
        if any(keyword in text for keyword in lowered_keywords):
            matches.append(item)
            seen_ids.add(item_id)
        if len(matches) >= max_matches:
            break

    return matches


def enrich_section_keywords(section: dict[str, Any]) -> list[str]:
    """Merge app.py keywords, export keywords, and DATIM workbook labels."""
    keywords = [str(keyword).lower() for keyword in section.get("keywords", []) if str(keyword).strip()]
    keywords.extend(str(keyword).lower() for keyword in section.get("export_keywords", []) if str(keyword).strip())

    guide_path = BASE_DIR / "Copy of DATIM DATA ENTRY GUIDE FY26 Q2.xlsx"
    if guide_path.exists():
        try:
            from app import load_datim_hiv_treatment_sections

            for workbook_section in load_datim_hiv_treatment_sections(guide_path):
                if workbook_section.get("label") != section.get("label"):
                    continue
                for item in workbook_section.get("items") or []:
                    text = str(item).strip().lower()
                    if text:
                        keywords.append(text)
                break
        except Exception:
            pass

    deduped: list[str] = []
    seen: set[str] = set()
    for keyword in keywords:
        if keyword not in seen:
            seen.add(keyword)
            deduped.append(keyword)
    return deduped


def resolve_section_metadata_matches(
    discovered: dict[str, list[dict[str, Any]]],
    section: dict[str, Any],
    *,
    max_matches: int = 100,
) -> tuple[list[dict[str, Any]], str]:
    """Pick indicator and/or data element matches for a HIV Treatment section."""
    keywords = enrich_section_keywords(section)
    sources = section.get("sources") or ["indicators", "dataElements"]
    indicators = discovered.get("indicators", [])
    data_elements = discovered.get("dataElements", [])

    indicator_matches = pick_all_matches(indicators, keywords, max_matches=max_matches) if "indicators" in sources else []
    if indicator_matches:
        return indicator_matches, "indicators"

    element_matches = pick_all_matches(data_elements, keywords, max_matches=max_matches) if "dataElements" in sources else []
    if element_matches:
        return element_matches, "dataElements"

    return [], ""


def analytics_response_to_frame(payload: dict[str, Any]) -> pd.DataFrame:
    """Build a dataframe with dx, pe, ou, value columns from a DHIS analytics payload."""
    headers = payload.get("headers", [])
    column_names: list[str] = []
    for header in headers:
        name = str(header.get("column") or header.get("name") or "").strip().lower()
        column_names.append(name)

    rows = payload.get("rows", [])
    if not rows:
        return pd.DataFrame(columns=["dx", "pe", "ou", "value"])

    frame = pd.DataFrame(rows, columns=column_names[: len(rows[0])] if rows else column_names)
    rename_map = {
        "data": "dx",
        "dataelement": "dx",
        "data element": "dx",
        "period": "pe",
        "organisation unit": "ou",
        "orgunit": "ou",
        "organisationunit": "ou",
    }
    frame = frame.rename(columns={column: rename_map.get(column, column) for column in frame.columns})

    for required in ("dx", "pe", "ou", "value"):
        if required not in frame.columns:
            frame[required] = ""

    return frame[["dx", "pe", "ou", "value"]]


def fetch_section_analytics(
    session: requests.Session,
    settings: dict[str, str],
    element_ids: list[str],
    *,
    context: str,
) -> pd.DataFrame:
    auth = auth_for(settings)
    base_url = settings["base_url"]
    org_unit = settings["org_unit"]

    if not element_ids:
        return pd.DataFrame(columns=["dx", "pe", "ou", "value"])

    org_dimension = (
        f"ou:{org_unit}"
        if org_unit and org_unit.upper() != "USER_ORGUNIT"
        else "ou:LEVEL-4"
    )

    frames: list[pd.DataFrame] = []
    for batch_index, start in enumerate(range(0, len(element_ids), ANALYTICS_BATCH_SIZE)):
        batch_ids = element_ids[start : start + ANALYTICS_BATCH_SIZE]
        params = {
            "dimension": [
                f"dx:{';'.join(batch_ids)}",
                "pe:LAST_12_MONTHS",
                org_dimension,
            ],
            "displayProperty": "NAME",
        }
        response = session.get(f"{base_url}/api/analytics.json", auth=auth, params=params, timeout=180)
        raise_for_dhis(response, f"{context}:batch:{batch_index + 1}")
        batch_frame = analytics_response_to_frame(response.json())
        if not batch_frame.empty:
            frames.append(batch_frame)

    if not frames:
        return pd.DataFrame(columns=["dx", "pe", "ou", "value"])

    return pd.concat(frames, ignore_index=True)


def export_hiv_treatment_sections(
    session: requests.Session,
    settings: dict[str, str],
    output_dir: Path,
    sections: list[dict[str, Any]] | None = None,
) -> dict[str, Path]:
    """Export DHIS analytics CSVs for configured HIV Treatment subtabs."""
    sections = sections or HIV_TREATMENT_SECTION_EXPORTS
    base_url = settings["base_url"]
    if not base_url:
        raise DhisExportError("Missing DHIS base URL. Set DHIS_BASE_URL in your environment.")

    discovered = discover_metadata(session, settings)
    results: dict[str, Path] = {}

    for section in sections:
        label = section["label"]
        slug = section["slug"]
        matches, match_source = resolve_section_metadata_matches(discovered, section)

        if not matches:
            print(f"[hiv-treatment] No {match_source or 'metadata'} matched '{label}' ({slug})")
            continue

        element_ids = [str(item["id"]) for item in matches if item.get("id")]
        sample_names = ", ".join(str(item.get("name", "")) for item in matches[:3])
        print(
            f"[hiv-treatment] Exporting '{label}' -> {slug}.csv "
            f"({len(element_ids)} {match_source}; e.g. {sample_names})"
        )

        frame = fetch_section_analytics(
            session,
            settings,
            element_ids,
            context=f"analytics:hiv_treatment:{slug}",
        )
        if frame.empty:
            print(f"[hiv-treatment] No analytics rows returned for '{label}'")
            continue

        csv_path = output_dir / "raw" / f"{slug}.csv"
        frame.to_csv(csv_path, index=False)
        results[slug] = csv_path
        print(f"[hiv-treatment] Wrote {len(frame)} rows -> {csv_path}")

    return results


def export_analytics(session: requests.Session, settings: dict[str, str], output_dir: Path) -> dict[str, Path]:
    auth = auth_for(settings)
    base_url = settings["base_url"]
    org_unit = settings["org_unit"]
    discovered = discover_metadata(session, settings)
    data_elements = discovered.get("dataElements", [])

    anc_element = pick_first_match(data_elements, ["anc 1", "antenatal care 1", "anc1", "anc visits"])
    finance_element = pick_first_match(data_elements, ["spend", "expenditure", "cost", "budget"])
    coverage_element = pick_first_match(data_elements, ["coverage", "rate", "percent", "pct"])
    anc_two_element = pick_first_match(data_elements, ["anc 2", "antenatal care 2", "anc2"])
    anc_three_element = pick_first_match(data_elements, ["anc 3", "antenatal care 3", "anc3"])

    analytics_requests = {
        "anc": anc_element,
        "finance": finance_element,
        "coverage": coverage_element,
        "anc_2": anc_two_element,
        "anc_3": anc_three_element,
    }

    results: dict[str, Path] = {}
    for name, element in analytics_requests.items():
        if not element:
            continue
        params = {
            "dimension": [
                f"dx:{element['id']}",
                "pe:LAST_12_MONTHS",
                f"ou:{org_unit}" if org_unit else "ou:LEVEL-4",
            ],
            "displayProperty": "NAME",
        }
        response = session.get(f"{base_url}/api/analytics.json", auth=auth, params=params, timeout=120)
        raise_for_dhis(response, f"analytics:{name}")
        payload = response.json()
        headers = [header.get("name", "") for header in payload.get("headers", [])]
        frame = pd.DataFrame(payload.get("rows", []), columns=headers)
        csv_path = output_dir / "raw" / f"{name}.csv"
        frame.to_csv(csv_path, index=False)
        results[name] = csv_path

    return results


def export_single_element(session: requests.Session, settings: dict[str, str], output_dir: Path, element_identifier: str) -> Path | None:
    """Export analytics for a single data element specified by id or keywords.

    `element_identifier` may be a DHIS id (uid) or a short keyword/name to match.
    Returns the CSV path when successful, otherwise None.
    """
    auth = auth_for(settings)
    base_url = settings["base_url"]
    org_unit = settings["org_unit"]
    if not base_url:
        raise DhisExportError("Missing DHIS base URL. Set DHIS_BASE_URL in your environment.")

    discovered = discover_metadata(session, settings)
    data_elements = discovered.get("dataElements", [])

    # If identifier looks like an id (alphanumeric uid), try direct match first
    element = None
    if element_identifier and any(ch.isdigit() for ch in element_identifier):
        for it in data_elements:
            if it.get("id") == element_identifier or (it.get("code") or "") == element_identifier:
                element = it
                break

    # fallback: match by keywords
    if not element:
        keywords = [p.strip() for p in element_identifier.split() if p.strip()]
        element = pick_first_match(data_elements, keywords)

    if not element:
        print(f"No matching data element found for '{element_identifier}'.")
        return None

    params = {
        "dimension": [
            f"dx:{element['id']}",
            "pe:LAST_12_MONTHS",
            f"ou:{org_unit}" if org_unit else "ou:LEVEL-4",
        ],
        "displayProperty": "NAME",
    }
    response = session.get(f"{base_url}/api/analytics.json", auth=auth, params=params, timeout=120)
    raise_for_dhis(response, f"analytics:element:{element.get('id')}")
    payload = response.json()
    headers = [header.get("name", "") for header in payload.get("headers", [])]
    frame = pd.DataFrame(payload.get("rows", []), columns=headers)
    csv_path = output_dir / "raw" / f"element_{element.get('id')}.csv"
    frame.to_csv(csv_path, index=False)
    print(f"Exported element '{element.get('name')}' -> {csv_path}")
    return csv_path


def export_combined_sample(output_dir: Path) -> Path:
    raw_files = list((output_dir / "raw").glob("*.csv"))
    combined_frames = []
    for path in raw_files:
        frame = pd.read_csv(path)
        frame["source_file"] = path.name
        combined_frames.append(frame)

    combined = pd.concat(combined_frames, ignore_index=True, sort=False) if combined_frames else pd.DataFrame()
    combined_path = output_dir / "processed" / "dhis_combined.csv"
    combined.to_csv(combined_path, index=False)
    return combined_path


def export_hospital_directory(output_dir: Path) -> Path | None:
    """Build an all-hospitals directory from raw DHIS analytics rows.

    The output contains one row per organisation unit referenced in the analytics CSVs,
    with the hospital name resolved from `organisation_units.csv` when available.
    """
    raw_dir = output_dir / "raw"
    meta_path = output_dir / "meta" / "organisation_units.csv"
    if not meta_path.exists() and not raw_dir.exists():
        return None

    raw_rows: list[pd.DataFrame] = []
    if raw_dir.exists():
        for csv_path in raw_dir.glob("*.csv"):
            try:
                frame = pd.read_csv(csv_path)
            except Exception:
                continue
            if "ou" not in frame.columns:
                continue
            subset = frame[["ou"]].copy()
            subset["source_file"] = csv_path.name
            raw_rows.append(subset)

    summary = pd.DataFrame(columns=["hospital_id", "observations", "source_files"])
    if raw_rows:
        source = pd.concat(raw_rows, ignore_index=True)
        source["ou"] = source["ou"].astype(str)
        summary = source.groupby("ou", as_index=False).agg(
            observations=("source_file", "size"),
            source_files=("source_file", lambda values: ", ".join(sorted(set(values)))),
        )
        summary = summary.rename(columns={"ou": "hospital_id"})

    hospitals = pd.DataFrame()
    if meta_path.exists():
        meta = pd.read_csv(meta_path)
        if "id" in meta.columns and "name" in meta.columns:
            meta = meta[[column for column in ["id", "name", "level", "path"] if column in meta.columns]].copy()
            meta["id"] = meta["id"].astype(str)
            if "level" in meta.columns:
                meta = meta[meta["level"].astype(str) == "5"].copy()
            hospitals = meta.rename(columns={"id": "hospital_id", "name": "hospital_name"})

    if hospitals.empty and not summary.empty:
        hospitals = summary.rename(columns={"hospital_id": "hospital_id"})[["hospital_id"]].copy()
        hospitals["hospital_name"] = hospitals["hospital_id"]

    if hospitals.empty:
        return None

    merged = hospitals.merge(summary, on="hospital_id", how="left")
    if "hospital_name" in merged.columns:
        merged["hospital_name"] = merged["hospital_name"].fillna(merged["hospital_id"])
    else:
        merged["hospital_name"] = merged["hospital_id"]

    columns = ["hospital_id", "hospital_name", "level", "path", "observations", "source_files"]
    for column in columns:
        if column not in merged.columns:
            merged[column] = ""
    merged["observations"] = pd.to_numeric(merged["observations"], errors="coerce").fillna(0).astype(int)
    merged = merged[columns].sort_values(["hospital_name", "hospital_id"])

    output_path = output_dir / "processed" / "hospitals.csv"
    merged.to_csv(output_path, index=False)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export DHIS data into structured CSV folders.")
    parser.add_argument("--base-url", default="", help="DHIS base URL")
    parser.add_argument("--username", default="", help="DHIS username")
    parser.add_argument("--password", default="", help="DHIS password")
    parser.add_argument("--org-unit", default="", help="Root org unit or analytics org unit")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Output folder for exported CSV files")
    parser.add_argument("--element", default="", help="Optional data element id or keywords to export single element analytics")
    parser.add_argument(
        "--hiv-treatment-only",
        action="store_true",
        help="Only export HIV Treatment section CSVs (requires existing metadata or will fetch it)",
    )
    parser.add_argument(
        "--skip-hiv-treatment",
        action="store_true",
        help="Skip HIV Treatment section analytics export",
    )
    args = parser.parse_args()

    settings = get_connection_settings(args)
    output_dir = Path(args.output_dir)
    ensure_output_dirs(output_dir)

    session = build_session()
    metadata_files: dict[str, Path] = {}
    analytics_files: dict[str, Path] = {}
    hiv_treatment_files: dict[str, Path] = {}

    if args.hiv_treatment_only:
        meta_dir = output_dir / "meta" / "data_elements.csv"
        if not meta_dir.exists():
            metadata_files = export_metadata(session, settings, output_dir)
        hiv_treatment_files = export_hiv_treatment_sections(session, settings, output_dir)
    else:
        metadata_files = export_metadata(session, settings, output_dir)
        analytics_files = export_analytics(session, settings, output_dir)
        if not args.skip_hiv_treatment:
            hiv_treatment_files = export_hiv_treatment_sections(session, settings, output_dir)

    # If an explicit element identifier was provided, export that element as well
    if getattr(args, "element", None):
        export_single_element(session, settings, output_dir, args.element)

    combined_path = export_combined_sample(output_dir)
    hospitals_path = export_hospital_directory(output_dir)

    manifest = {
        "base_url": settings["base_url"],
        "metadata_files": {key: str(path) for key, path in metadata_files.items()},
        "analytics_files": {key: str(path) for key, path in analytics_files.items()},
        "hiv_treatment_files": {key: str(path) for key, path in hiv_treatment_files.items()},
        "combined": str(combined_path),
        "hospitals": str(hospitals_path) if hospitals_path else "",
    }

    manifest_path = output_dir / "processed" / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Export complete. Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
