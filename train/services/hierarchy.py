"""Excel / XML workbook parsing helpers for the DATIM data-entry guide."""
from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Any

import xml.etree.ElementTree as ET

from services.common import clean_text


def load_datim_location_hierarchy(workbook_path: Path) -> dict[str, Any]:
    hierarchy: dict[str, Any] = {
        "counties": [],
        "subcounties_by_county": {},
        "facilities_by_county": {},
        "facilities_by_subcounty": {},
        "subcounties": [],
        "facilities": [],
    }

    if not workbook_path.exists():
        return hierarchy

    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    def resolve_shared_items(field: ET.Element) -> list[str]:
        shared_items = field.find("main:sharedItems", ns)
        if shared_items is None:
            return []

        items: list[str] = []
        for child in list(shared_items):
            tag = child.tag.split("}")[-1]
            if tag == "s":
                items.append(clean_text(child.attrib.get("v")))
            elif tag == "n":
                items.append(clean_text(child.attrib.get("v")))
            elif tag == "m":
                items.append("")
            else:
                items.append(clean_text(child.attrib.get("v")))
        return items

    def resolve_record_value(cell: ET.Element, items: list[str]) -> str:
        tag = cell.tag.split("}")[-1]
        if tag == "x":
            try:
                index = int(cell.attrib.get("v", "0"))
            except ValueError:
                return ""
            return items[index] if 0 <= index < len(items) else ""
        if tag == "s":
            return clean_text(cell.attrib.get("v"))
        if tag == "n":
            return clean_text(cell.attrib.get("v"))
        return clean_text(cell.attrib.get("v"))

    try:
        with zipfile.ZipFile(workbook_path) as workbook:
            definition = ET.fromstring(workbook.read("xl/pivotCache/pivotCacheDefinition1.xml"))
            cache_fields = definition.find("main:cacheFields", ns)
            if cache_fields is None:
                return hierarchy

            fields = cache_fields.findall("main:cacheField", ns)
            field_names = [clean_text(field.attrib.get("name")) for field in fields]
            county_index = next((index for index, name in enumerate(field_names) if name.lower() == "county"), None)
            subcounty_index = next(
                (index for index, name in enumerate(field_names) if name.lower() in {"subcounty", "sub county", "sub-county"}),
                None,
            )

            if county_index is None or subcounty_index is None:
                return hierarchy

            county_items = resolve_shared_items(fields[county_index])
            subcounty_items = resolve_shared_items(fields[subcounty_index])
            facility_index = next((index for index, name in enumerate(field_names) if name.lower() in {"faility", "facility"}), None)
            facility_items = resolve_shared_items(fields[facility_index]) if facility_index is not None else []
            records_root = ET.fromstring(workbook.read("xl/pivotCache/pivotCacheRecords1.xml"))

            subcounty_mapping: dict[str, set[str]] = {}
            county_facility_mapping: dict[str, set[str]] = {}
            subcounty_facility_mapping: dict[str, dict[str, set[str]]] = {}
            all_facilities: set[str] = set()
            for record in records_root.findall("main:r", ns):
                cells = list(record)
                if len(cells) <= max(county_index, subcounty_index, facility_index or 0):
                    continue

                county = clean_text(resolve_record_value(cells[county_index], county_items))
                subcounty = clean_text(resolve_record_value(cells[subcounty_index], subcounty_items))
                facility = clean_text(resolve_record_value(cells[facility_index], facility_items)) if facility_index is not None else ""
                if not county or not subcounty:
                    continue

                subcounty_mapping.setdefault(county, set()).add(subcounty)
                if facility:
                    county_facility_mapping.setdefault(county, set()).add(facility)
                    subcounty_facility_mapping.setdefault(county, {}).setdefault(subcounty, set()).add(facility)
                    all_facilities.add(facility)

            hierarchy["counties"] = sorted(subcounty_mapping.keys())
            hierarchy["subcounties_by_county"] = {county: sorted(subcounties) for county, subcounties in subcounty_mapping.items()}
            hierarchy["facilities_by_county"] = {county: sorted(facilities) for county, facilities in county_facility_mapping.items()}
            hierarchy["facilities_by_subcounty"] = {
                county: {subcounty: sorted(facilities) for subcounty, facilities in sub_map.items()}
                for county, sub_map in subcounty_facility_mapping.items()
            }
            hierarchy["subcounties"] = sorted({subcounty for subcounties in subcounty_mapping.values() for subcounty in subcounties})
            hierarchy["facilities"] = sorted(all_facilities)
            return hierarchy
    except Exception:
        return hierarchy


def load_location_hierarchy_from_csv(csv_path: Path) -> dict[str, Any]:
    """Load location hierarchy from location_hierarchy.csv (County,SubCounty,Facility).
    Returns same dict structure as load_datim_location_hierarchy()."""
    import pandas as pd

    hierarchy: dict[str, Any] = {
        "counties": [],
        "subcounties_by_county": {},
        "facilities_by_county": {},
        "facilities_by_subcounty": {},
        "subcounties": [],
        "facilities": [],
    }

    if not csv_path.exists():
        return hierarchy

    try:
        df = pd.read_csv(csv_path)
        required = {"County", "SubCounty", "Facility"}
        if not required.issubset(df.columns):
            return hierarchy

        df = df.dropna(subset=["County", "SubCounty", "Facility"])

        subcounty_mapping: dict[str, set[str]] = {}
        county_facility_mapping: dict[str, set[str]] = {}
        subcounty_facility_mapping: dict[str, dict[str, set[str]]] = {}
        all_facilities: set[str] = set()

        for _, row in df.iterrows():
            county = str(row["County"]).strip()
            subcounty = str(row["SubCounty"]).strip()
            facility = str(row["Facility"]).strip()
            if not county or not subcounty or not facility:
                continue

            subcounty_mapping.setdefault(county, set()).add(subcounty)
            county_facility_mapping.setdefault(county, set()).add(facility)
            subcounty_facility_mapping.setdefault(county, {}).setdefault(subcounty, set()).add(facility)
            all_facilities.add(facility)

        hierarchy["counties"] = sorted(subcounty_mapping.keys())
        hierarchy["subcounties_by_county"] = {c: sorted(s) for c, s in subcounty_mapping.items()}
        hierarchy["facilities_by_county"] = {c: sorted(f) for c, f in county_facility_mapping.items()}
        hierarchy["facilities_by_subcounty"] = {
            c: {sc: sorted(f) for sc, f in sc_map.items()}
            for c, sc_map in subcounty_facility_mapping.items()
        }
        hierarchy["subcounties"] = sorted({sc for subs in subcounty_mapping.values() for sc in subs})
        hierarchy["facilities"] = sorted(all_facilities)
        return hierarchy
    except Exception:
        return hierarchy


def load_datim_hiv_treatment_sections(workbook_path: Path) -> list[dict[str, Any]]:
    sections = [
        {
            "label": "Newly Started on ART",
            "keywords": ["newly started on art", "new started on art", "sum of tbart new", "start on art"],
        },
        {
            "label": "Current on ART",
            "keywords": ["current on art", "previously enrolled on art", "enrolled on art"],
        },
        {
            "label": "ART Optimization",
            "keywords": ["art optimization", "tbart", "pmtct art"],
        },
        {
            "label": "Adverse Events - AE",
            "keywords": ["adverse events", "ae"],
        },
        {
            "label": "DSD",
            "keywords": ["dsd: hts_index", "dsd: tx_ml", "dsd: tx_rtt", "dsd"],
        },
        {
            "label": "VL Monitoring",
            "keywords": ["vl monitoring", "tx_pvls", "pvls", "routine"],
        },
        {
            "label": "Treatment Outcomes",
            "keywords": ["treatment outcomes", "iit", "rtt", "outcome"],
        },
        {
            "label": "OTZ",
            "keywords": ["otz"],
        },
        {
            "label": "OVC",
            "keywords": ["ovc"],
        },
        {
            "label": "COVID-19",
            "keywords": ["covid"],
        },
        {
            "label": "AHD",
            "keywords": ["ahd", "advanced hiv disease"],
        },
    ]

    if not workbook_path.exists():
        return [{"label": section["label"], "items": []} for section in sections]

    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    def load_shared_strings(workbook: zipfile.ZipFile) -> list[str]:
        if "xl/sharedStrings.xml" not in workbook.namelist():
            return []
        shared_root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
        values: list[str] = []
        seen: set[str] = set()
        for shared_item in shared_root.findall("main:si", ns):
            text_parts = [node.text or "" for node in shared_item.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")]
            text = clean_text("".join(text_parts))
            if not text:
                continue
            key = text.lower()
            if key in seen:
                continue
            seen.add(key)
            values.append(text)
        return values

    try:
        with zipfile.ZipFile(workbook_path) as workbook:
            shared_strings = load_shared_strings(workbook)
    except Exception:
        shared_strings = []

    results: list[dict[str, Any]] = []
    for section in sections:
        label = section["label"]
        keywords = [keyword.lower() for keyword in section["keywords"]]
        matches: list[str] = []
        for text in shared_strings:
            lower_text = text.lower()
            if any(keyword in lower_text for keyword in keywords):
                matches.append(text)
        results.append(
            {
                "label": label,
                "items": matches[:8],
                "match_count": int(len(matches)),
            }
        )

    return results
