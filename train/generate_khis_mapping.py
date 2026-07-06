"""
Cross-reference CSV facilities with KHIS MOH 717 org units
and generate/update mhu_khis_mapping.json
"""
import csv, json, os, re, sys
from pathlib import Path

BASE = Path(__file__).parent
DATA = BASE / "data"
CSV_FILES = [BASE.parent / "data.csv", BASE.parent / "data2.csv"]
KHIS_ORG_FILE = DATA / "khis_moh717_orgunits.json"
MAPPING_FILE = DATA / "mhu_khis_mapping.json"

# ── Load KHIS org units ──
with open(KHIS_ORG_FILE) as f:
    khis_data = json.load(f)

khis_orgs = khis_data["organisationUnits"]
print(f"KHIS org units with MOH 717: {len(khis_orgs)}")

# Build lookup: normalized name -> {id, name, level}
khis_by_name = {}
for ou in khis_orgs:
    key = ou["name"].strip().lower()
    # Also store without common suffixes
    khis_by_name[key] = ou
    # Also strip trailing " hospital", " health centre", " dispensary" etc for fuzzy matching
    for suffix in [" hospital", " health centre", " dispensary", " sub-county hospital", " sub-district hospital", " district hospital", " nursing home", " medical clinic"]:
        if key.endswith(suffix):
            khis_by_name[key.replace(suffix, "").strip()] = ou
    # Also store with " hospital" removed
    if key.endswith(" hospital"):
        khis_by_name[key[:-9].strip()] = ou

print(f"KHIS lookup entries (with aliases): {len(khis_by_name)}")

# ── Load CSV facilities ──
csv_facilities = {}  # name -> {county, owner_type, owner}
for csv_path in CSV_FILES:
    if not csv_path.exists():
        continue
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["Name"].strip()
            county = row["County"].strip()
            owner_type = row["Owner type"].strip()
            owner = row["Owner"].strip()
            if name not in csv_facilities:
                csv_facilities[name] = {
                    "county": county,
                    "owner_type": owner_type,
                    "owner": owner,
                }

print(f"CSV unique facilities: {len(csv_facilities)}")

# ── Match CSV facilities to KHIS org units ──
matched = []
unmatched = []

# First pass: exact match
for csv_name, csv_info in csv_facilities.items():
    csv_key = csv_name.lower().strip()
    
    # Direct match
    if csv_key in khis_by_name:
        ou = khis_by_name[csv_key]
        matched.append((csv_name, csv_info, ou))
        continue
    
    # Try removing trailing " hospital" from CSV name (since CSV sometimes adds " hospital")
    csv_clean = re.sub(r'\s+hospital$', '', csv_key)
    if csv_clean != csv_key and csv_clean in khis_by_name:
        ou = khis_by_name[csv_clean]
        matched.append((csv_name, csv_info, ou))
        continue
    
    # Try finding a KHIS org that contains the CSV name or vice versa
    found = False
    for khis_key, ou in khis_by_name.items():
        if csv_key in khis_key or khis_key in csv_key:
            matched.append((csv_name, csv_info, ou))
            found = True
            break
    
    if not found:
        unmatched.append((csv_name, csv_info))

print(f"Matched: {len(matched)}")
print(f"Unmatched: {len(unmatched)}")
print()

# Show some unmatched examples
if unmatched:
    print("Sample unmatched (first 20):")
    for name, info in unmatched[:20]:
        print(f"  '{name}' ({info['county']}, {info['owner']})")

# ── Now build/update the mapping ──
# Load existing mapping
with open(MAPPING_FILE, "r") as f:
    mapping = json.load(f)

existing_facilities = mapping.get("facilities", {})
existing_ownership = mapping.get("ownership_groups", {})

# For each matched facility, add to mapping if not already there
new_count = 0
already_count = 0
ownership_map = {}  # owner_group_name -> list of {id, name}

for csv_name, csv_info, ou in matched:
    uid = ou["id"]
    
    # Skip if already in facilities
    if uid in existing_facilities:
        already_count += 1
        continue
    
    # Determine ownership group
    owner = csv_info["owner"]
    owner_type = csv_info["owner_type"]
    
    # Map owner to ownership group name
    if owner_type == "Ministry of Health" or "Ministry of Health" in owner:
        group = "Revised Ministry of Health (2018)"
    elif "Private" in owner_type:
        group = "Revised Private(2018)"
    elif "Faith" in owner_type:
        group = "Revised Faith Based Organisation (2018)"
    elif "NGO" in owner_type or "Non-Governmental" in owner_type:
        group = "Revised Private(2018)"  # approximate
    else:
        group = "UNCLASSIFIED"
    
    # Set defaults for parent/county
    county = csv_info.get("county", "Unknown")
    parent = county.replace(" County", "") + " Ward"  # approximate
    
    # Add to facilities
    existing_facilities[uid] = {
        "name": ou["name"],
        "ownership": group,
        "level": ou["level"],
        "parent": parent,
        "county": county
    }
    
    # Add to ownership group
    if group not in existing_ownership:
        existing_ownership[group] = []
    existing_ownership[group].append({
        "id": uid,
        "name": ou["name"]
    })
    
    new_count += 1

print(f"\nAlready in mapping: {already_count}")
print(f"New facilities added: {new_count}")
print(f"Total facilities in mapping: {len(existing_facilities)}")

# Sort ownership groups
for group in existing_ownership:
    existing_ownership[group].sort(key=lambda x: x["name"].lower())

# ── Write updated mapping ──
mapping["facilities"] = existing_facilities
mapping["ownership_groups"] = existing_ownership

# Sort facilities by name
sorted_facilities = dict(sorted(existing_facilities.items(), key=lambda x: x[1]["name"].lower()))
mapping["facilities"] = sorted_facilities

with open(MAPPING_FILE, "w") as f:
    json.dump(mapping, f, indent=2, ensure_ascii=False)

print(f"\n✅ Updated mapping written to {MAPPING_FILE}")
print(f"Total facilities: {len(mapping['facilities'])}")
print(f"Ownership groups: {list(mapping['ownership_groups'].keys())}")
