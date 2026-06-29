import os
import re
from typing import Dict, List, Tuple

import pandas as pd
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth


def slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower())
    return re.sub(r"_+", "_", s).strip("_")


def fetch_json(base: str, endpoint: str, auth: HTTPBasicAuth) -> dict:
    url = base + endpoint
    resp = requests.get(url, auth=auth, timeout=180)
    resp.raise_for_status()
    return resp.json()


def build_org_maps(org_units: List[dict]) -> Tuple[Dict[str, dict], Dict[str, str], Dict[str, List[dict]]]:
    by_id = {}
    level_by_id = {}
    children = {}

    for ou in org_units:
        ou_id = str(ou.get("id", ""))
        if not ou_id:
            continue
        ou_level = str(ou.get("level", ""))
        by_id[ou_id] = {
            "id": ou_id,
            "name": str(ou.get("name", "")),
            "level": ou_level,
            "path": str(ou.get("path", "")),
            "parent_id": str((ou.get("parent") or {}).get("id", "")),
        }
        level_by_id[ou_id] = ou_level

    for ou_id, ou in by_id.items():
        pid = ou.get("parent_id", "")
        if not pid:
            continue
        children.setdefault(pid, []).append(ou)

    return by_id, level_by_id, children


def get_descendant_facilities(anchor_id: str, by_id: Dict[str, dict]) -> List[dict]:
    anchor = by_id.get(anchor_id)
    if not anchor:
        return []

    anchor_path = anchor.get("path", "")
    if not anchor_path:
        return []

    facilities = []
    prefix = anchor_path + "/"
    for ou in by_id.values():
        path = ou.get("path", "")
        if path == anchor_path or path.startswith(prefix):
            if str(ou.get("level", "")) == "5":
                facilities.append(ou)
    return facilities


def lineage_for_facility(facility: dict, by_id: Dict[str, dict]) -> dict:
    path_ids = [p for p in str(facility.get("path", "")).split("/") if p]

    county_id = county_name = ""
    subcounty_id = subcounty_name = ""
    ward_id = ward_name = ""

    for ou_id in path_ids:
        node = by_id.get(ou_id)
        if not node:
            continue
        lvl = str(node.get("level", ""))
        if lvl == "2":
            county_id, county_name = node["id"], node["name"]
        elif lvl == "3":
            subcounty_id, subcounty_name = node["id"], node["name"]
        elif lvl == "4":
            ward_id, ward_name = node["id"], node["name"]

    return {
        "county_id": county_id,
        "county_name": county_name,
        "subcounty_id": subcounty_id,
        "subcounty_name": subcounty_name,
        "ward_id": ward_id,
        "ward_name": ward_name,
        "facility_id": facility.get("id", ""),
        "facility_name": facility.get("name", ""),
    }


def main() -> None:
    load_dotenv()
    base = os.getenv("DHIS_BASE_URL", "")
    user = os.getenv("DHIS_USERNAME", "")
    pwd = os.getenv("DHIS_PASSWORD", "")

    if not base or not user or not pwd:
        raise RuntimeError("Missing DHIS credentials in .env")

    auth = HTTPBasicAuth(user, pwd)

    groups_data = fetch_json(
        base,
        "organisationUnitGroups.json?fields=id,name,organisationUnits[id,name,level,path,parent[id,name]]&paging=false",
        auth,
    )
    org_data = fetch_json(
        base,
        "organisationUnits.json?fields=id,name,level,path,parent[id,name]&paging=false",
        auth,
    )

    groups = groups_data.get("organisationUnitGroups", [])
    org_units = org_data.get("organisationUnits", [])
    by_id, _, _ = build_org_maps(org_units)

    target_projects = ["Jamii Tekelezi", "CHAP Stawisha"]
    os.makedirs("exports", exist_ok=True)

    for project_name in target_projects:
        group = next((g for g in groups if str(g.get("name", "")).strip().lower() == project_name.lower()), None)
        if not group:
            print(f"[WARN] Project group not found: {project_name}")
            continue

        members = group.get("organisationUnits", [])
        member_ids = {str(m.get("id", "")) for m in members if str(m.get("id", ""))}

        facilities = {}
        for mid in member_ids:
            for fac in get_descendant_facilities(mid, by_id):
                facilities[str(fac.get("id", ""))] = fac

        rows = []
        for facility in facilities.values():
            line = lineage_for_facility(facility, by_id)
            rows.append({
                "project_name": project_name,
                **line,
            })

        df = pd.DataFrame(rows)
        if df.empty:
            print(f"[WARN] No facility rows built for project: {project_name}")
            continue

        df = df.sort_values(by=["county_name", "subcounty_name", "ward_name", "facility_name"]).reset_index(drop=True)
        out_file = os.path.join("exports", f"{slugify(project_name)}.csv")
        df.to_csv(out_file, index=False)
        print(f"[OK] {project_name}: {len(df)} rows -> {out_file}")


if __name__ == "__main__":
    main()
