"""
Efficient rebuild: Iterate over KHIS MOH 717 org units, look up in Excel.
Excel Master List is the authoritative source for owner types and counties.
"""
import json
import re
from pathlib import Path
from collections import OrderedDict

import pandas as pd
import requests
from requests.auth import HTTPBasicAuth

BASE = Path(__file__).parent
DATA_DIR = BASE / "data"
EXCEL_PATH = BASE.parent / "Kenya Facility Master List_with workload_send.xlsx"
MAPPING_PATH = DATA_DIR / "mhu_khis_mapping.json"
KHIS_ORG_FILE = DATA_DIR / "khis_moh717_orgunits.json"

# ── 1. Load Excel Master List ──
print("=" * 70)
print("1. Loading Kenya Facility Master List")
print("=" * 70)
df = pd.read_excel(EXCEL_PATH, header=1)
print(f"   Total rows: {len(df)}")

# Build lookup: normalized facility name -> {owner, owner_type, county}
excel_lookup = {}
for idx, row in df.iterrows():
    name = str(row.get("Name", "")).strip()
    if not name or name.lower() == "nan":
        continue
    key = name.lower().strip()
    excel_lookup[key] = {
        "owner": str(row.get("Owner", "")).strip(),
        "owner_type": str(row.get("Owner type", "")).strip(),
        "county": str(row.get("County", "")).strip(),
        "status": str(row.get("Operation status", "")).strip(),
    }
    # Also strip common suffixes for better matching
    for suffix in [
        " hospital", " health centre", " dispensary", " nursing home",
        " medical clinic", " medical centre", " medical center",
        " sub-county hospital", " sub-district hospital", " district hospital",
    ]:
        if key.endswith(suffix):
            alt = key[: -len(suffix)].strip()
            if alt not in excel_lookup:
                excel_lookup[alt] = excel_lookup[key]
                break

print(f"   Excel lookup entries: {len(excel_lookup)}")
print(f"   Unique owners: {df['Owner'].dropna().unique()}")
print(f"   Unique counties: {df['County'].dropna().nunique()}")

# ── 2. Load KHIS MOH 717 org units ──
print("\n" + "=" * 70)
print("2. Loading KHIS MOH 717 org units")
print("=" * 70)
with open(KHIS_ORG_FILE) as f:
    khis_data = json.load(f)
khis_orgs = khis_data["organisationUnits"]
print(f"   KHIS MOH 717 org units: {len(khis_orgs)}")

# ── 3. Match & Build ──
print("\n" + "=" * 70)
print("3. Matching & building mapping")
print("=" * 70)

def map_owner_to_group(owner_str):
    """Map Excel Owner column to Revised owner group name."""
    o = owner_str.lower().strip()
    # Ministry of Health / Government
    if ("ministry of health" in o or o == "ministry" or o == "moh"
        or o == "armed forces" or o == "national youth service"
        or o == "prisons" or o == "kenya police service"
        or o.startswith("public institution")
        or o.startswith("public")):
        return "Revised Ministry of Health (2018)"
    # Faith Based Organizations
    elif ("faith" in o or "fbo" in o or "mission" in o
          or o == "christian health association of kenya"
          or o == "kenya episcopal conference-catholic secretariat"
          or o == "other faith based"
          or o == "seventh day adventist"
          or o == "supreme council for kenya muslims"
          or "catholic" in o or "church" in o):
        return "Revised Faith Based Organisation (2018)"
    # NGOs
    elif "ngo" in o or "non-governmental" in o or "non governmental" in o:
        return "Revised NGO (2018)"
    # Private
    elif "private" in o:
        return "Revised Private(2018)"
    else:
        return "UNCLASSIFIED"

new_facilities = OrderedDict()
ownership_groups = {}
county_owner_map = {}
excel_matched = 0
fallback_count = 0
skipped = 0

for ou in khis_orgs:
    uid = ou["id"]
    name = ou["name"]
    level = ou["level"]
    key = name.lower().strip()

    # Try to find in Excel
    excel_info = excel_lookup.get(key)
    if not excel_info:
        # Try stripping trailing " (something)" 
        paren_idx = key.find(" (")
        if paren_idx > 0:
            excel_info = excel_lookup.get(key[:paren_idx])

    if excel_info:
        excel_matched += 1
        county = excel_info["county"] if excel_info["county"] and excel_info["county"] != "nan" else "Unknown"
        owner = excel_info["owner"]
        group = map_owner_to_group(owner)
    else:
        fallback_count += 1
        skipped += 1
        continue

    if not county or county == "nan":
        county = "Unknown"

    new_facilities[uid] = {
        "name": name,
        "ownership": group,
        "level": level,
        "parent": county,
        "county": county,
    }

    if group not in ownership_groups:
        ownership_groups[group] = []
    ownership_groups[group].append({"id": uid, "name": name})

    if county not in county_owner_map:
        county_owner_map[county] = set()
    county_owner_map[county].add(group)

print(f"   Matched (found in Excel): {excel_matched}")
print(f"   Not in Excel (skipped): {fallback_count}")
print(f"   Total in mapping: {len(new_facilities)}")

# ── 4. Load existing tabs ──
if MAPPING_PATH.exists():
    with open(MAPPING_PATH) as f:
        existing = json.load(f)
    tabs = existing.get("tabs", {})
    print(f"\n   Preserved existing tabs: {list(tabs.keys())}")
else:
    tabs = {}

# Sort
new_facilities = OrderedDict(sorted(new_facilities.items(), key=lambda x: x[1]["name"].lower()))
for grp in ownership_groups:
    ownership_groups[grp] = sorted(ownership_groups[grp], key=lambda x: x["name"].lower())

# ── 5. Write ──
mapping = {
    "facilities": new_facilities,
    "ownership_groups": ownership_groups,
    "tabs": tabs,
}

with open(MAPPING_PATH, "w", encoding="utf-8") as f:
    json.dump(mapping, f, indent=2, ensure_ascii=False)

print(f"\n{'=' * 70}")
print(f"COMPLETE")
print(f"{'=' * 70}")
print(f"   Total facilities: {len(new_facilities)}")
print(f"   Ownership groups: {list(ownership_groups.keys())}")
for grp, facs in sorted(ownership_groups.items()):
    print(f"     {grp}: {len(facs)}")

print(f"\n   Facilities by county:")
for county in sorted(county_owner_map.keys()):
    count = sum(1 for f in new_facilities.values() if f["county"] == county)
    ots = county_owner_map[county]
    print(f"     {county:25s}: {count:5d} facilities | owner types: {sorted(ots)}")

# Show Kiambu
print(f"\n   Kiambu County:")
kiambu_facs = [(uid, f) for uid, f in new_facilities.items() if f["county"] == "Kiambu"]
print(f"     Total: {len(kiambu_facs)}")
kiambu_ots = set()
for uid, f in kiambu_facs[:15]:
    kiambu_ots.add(f["ownership"])
    print(f"     {f['name'][:55]:55s} | {f['ownership']}")
if len(kiambu_facs) > 15:
    print(f"     ... and {len(kiambu_facs) - 15} more")
print(f"     Owner types in Kiambu: {sorted(kiambu_ots)}")

# Show Nairobi
print(f"\n   Nairobi County:")
nrb_facs = [(uid, f) for uid, f in new_facilities.items() if f["county"] == "Nairobi"]
print(f"     Total: {len(nrb_facs)}")
nrb_ots = set()
for uid, f in nrb_facs[:10]:
    nrb_ots.add(f["ownership"])
    print(f"     {f['name'][:55]:55s} | {f['ownership']}")
if len(nrb_facs) > 10:
    print(f"     ... and {len(nrb_facs) - 10} more")
print(f"     Owner types in Nairobi: {sorted(nrb_ots)}")
