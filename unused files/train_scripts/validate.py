"""
validate.py
===========
Reads the .env file for DHIS2 credentials, reads indicators/data_elements CSVs to
discover the TX_Curr (currently on treatment) indicator/data element, constructs the
DHIS2 Analytics API URL, queries data for Meru District Hospital, and prints the result.
"""

import csv
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

# ---------------------------------------------------------------------------
# 1. Load environment variables from .env
# ---------------------------------------------------------------------------
load_dotenv()

BASE_URL = (os.getenv("DHIS_BASE_URL") or "").rstrip("/")
USERNAME = os.getenv("DHIS_USERNAME") or ""
PASSWORD = os.getenv("DHIS_PASSWORD") or ""

if not BASE_URL or not USERNAME or not PASSWORD:
    print("ERROR: Missing DHIS2 credentials in .env file.")
    print("Please ensure DHIS_BASE_URL, DHIS_USERNAME, and DHIS_PASSWORD are set.")
    sys.exit(1)

print(f"[1] DHIS2 Base URL : {BASE_URL}")
print(f"[2] Username       : {USERNAME}")

# ---------------------------------------------------------------------------
# 2. Paths to the metadata CSVs
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
INDICATORS_CSV = BASE_DIR / "data" / "dhis" / "meta" / "indicators.csv"
DATA_ELEMENTS_CSV = BASE_DIR / "data" / "dhis" / "meta" / "data_elements.csv"
ORG_UNITS_CSV = BASE_DIR / "data" / "dhis" / "meta" / "organisation_units.csv"

# ---------------------------------------------------------------------------
# 3. Helper – read a CSV into a list of dicts
# ---------------------------------------------------------------------------
def read_csv(path: Path) -> list[dict[str, str]]:
    """Return all rows from a CSV file as a list of dicts."""
    rows: list[dict[str, str]] = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Strip whitespace from keys and values
            cleaned = {k.strip(): v.strip() for k, v in row.items()}
            rows.append(cleaned)
    return rows

# ---------------------------------------------------------------------------
# 4. Find the org unit ID for "Meru District Hospital"
# ---------------------------------------------------------------------------
print("\n[3] Looking up Meru District Hospital in organisation_units.csv ...")
org_units = read_csv(ORG_UNITS_CSV)

meru_org_unit_id = None
for ou in org_units:
    name = ou.get("name", "").strip()
    if name.lower() == "meru district hospital":
        meru_org_unit_id = ou.get("id", "").strip()
        print(f"    → Found! Name='{name}', ID='{meru_org_unit_id}'")
        break

if not meru_org_unit_id:
    print("ERROR: Could not find 'Meru District Hospital' in organisation_units.csv")
    sys.exit(1)

# ---------------------------------------------------------------------------
# 5. Find the TX_Curr indicator and data element IDs
#    Primary: indicator "TX_Curr STA ALL" (BJQlqerv0YT) – aggregate total.
#    Secondary: data element "C&T (facility) - TX_CURR" (ULVYtRIxS5m).
# ---------------------------------------------------------------------------
print("\n[4] Looking up TX_Curr indicator/data element IDs from CSVs ...")
indicators = read_csv(INDICATORS_CSV)
data_elements = read_csv(DATA_ELEMENTS_CSV)

# --- Indicator: TX_Curr STA ALL (aggregate total) ---
TX_CURR_INDICATOR_ID = "BJQlqerv0YT"
TX_CURR_INDICATOR_NAME = "TX_Curr STA ALL"

tx_curr_indicator_id = None
tx_curr_indicator_name = None
for ind in indicators:
    name = ind.get("name", "").strip()
    if name == TX_CURR_INDICATOR_NAME:
        tx_curr_indicator_id = ind.get("id", "").strip()
        tx_curr_indicator_name = name
        print(f"    → Indicator: '{name}' → ID: {tx_curr_indicator_id}")
        break
if not tx_curr_indicator_id:
    print(f"    ⚠ Indicator '{TX_CURR_INDICATOR_NAME}' not found in CSV.")
    # Fallback: any standalone TX_Curr indicator without prefix
    for ind in indicators:
        n = ind.get("name", "").strip()
        if n.lower().startswith("tx_curr") and "all" in n.lower():
            tx_curr_indicator_id = ind.get("id", "").strip()
            tx_curr_indicator_name = n
            print(f"    → Fallback indicator: '{n}' → ID: {tx_curr_indicator_id}")
            break

# --- Data element: C&T (facility) - TX_CURR ---
TX_CURR_DE_ID = "ULVYtRIxS5m"
TX_CURR_DE_NAME = "C&T (facility) - TX_CURR"

tx_curr_de_id = None
tx_curr_de_name = None
for de in data_elements:
    name = de.get("name", "").strip()
    if name == TX_CURR_DE_NAME:
        tx_curr_de_id = de.get("id", "").strip()
        tx_curr_de_name = name
        print(f"    → DataElement: '{name}' → ID: {tx_curr_de_id}")
        break

# ---------------------------------------------------------------------------
# 6. Define a helper to query the DHIS2 Analytics API and display results
# ---------------------------------------------------------------------------
auth = HTTPBasicAuth(USERNAME, PASSWORD)
ANALYTICS_URL = f"{BASE_URL}/api/analytics.json"


def query_and_display(dx_id: str, dx_name: str, dx_type: str, ou_label: str, ou_id: str) -> bool:
    """Query DHIS2 analytics and print the results. Returns True if data found."""
    print(f"\n  Querying with {dx_type} '{dx_name}' ({dx_id}) ...")
    print(f"  Org unit: {ou_id} ({ou_label})")
    print(f"  Period : LAST_12_MONTHS")

    params = {
        "dimension": [
            f"dx:{dx_id}",
            "pe:LAST_12_MONTHS",
            f"ou:{ou_id}",
        ],
        "displayProperty": "NAME",
        "skipMeta": "false",
    }

    try:
        resp = requests.get(ANALYTICS_URL, auth=auth, params=params, timeout=120)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Request failed: {e}")
        return False

    rows = data.get("rows", [])
    if not rows:
        return False

    headers = data.get("headers", [])
    col_index = {h.get("name", ""): i for i, h in enumerate(headers)}

    print(f"\n  {'Period':<10} {'Value':>10}")
    print("  " + "-" * 22)
    total = 0.0
    for row in rows:
        pe_val = row[col_index.get("pe", 1)]
        val = row[col_index.get("value", 3)]
        if len(pe_val) == 6 and pe_val.isdigit():
            pe_val = f"{pe_val[:4]}-{pe_val[4:]}"
        try:
            num_val = float(val) if val else 0.0
        except ValueError:
            num_val = 0.0
        total += num_val
        print(f"  {pe_val:<10} {num_val:>10.0f}")
    print("  " + "-" * 22)
    print(f"  {'TOTAL':<10} {total:>10.0f}")

    last_row = rows[-1]
    last_val = last_row[col_index.get("value", 3)]
    last_pe = last_row[col_index.get("pe", 1)]
    if len(last_pe) == 6 and last_pe.isdigit():
        last_pe = f"{last_pe[:4]}-{last_pe[4:]}"
    print(f"\n  ➡  Most recent period : {last_pe}")
    print(f"  ➡  TX_Curr value      : {last_val}")
    return True


# ---------------------------------------------------------------------------
# 7. Get parent org unit IDs for broader fallback queries
# ---------------------------------------------------------------------------
# Meru District Hospital hierarchy:
#   HfVjCurKxh2 (Kenya) → Y52XNJ50hYb (Meru County)
#   → BDxUGx86itV (Imenti North Sub County)
#   → EossaGDQulP (Municipality Ward)
#   → uwvOG2N2Cmt (Meru District Hospital)
MERU_COUNTY_ID = "Y52XNJ50hYb"
MENTI_NORTH_ID = "BDxUGx86itV"
MUNICIPALITY_WARD_ID = "EossaGDQulP"

# ---------------------------------------------------------------------------
# 8. Try queries in priority order
# ---------------------------------------------------------------------------
print("\n[5] Querying DHIS2 Analytics API for TX_Curr at Meru District Hospital ...")

found = False

query_strategies = []

# Build a list of (dx_id, dx_name, dx_type, ou_display, ou_value)
if tx_curr_indicator_id:
    query_strategies.append(
        (tx_curr_indicator_id, tx_curr_indicator_name, "indicator",
         f"Meru District Hospital (exact)", meru_org_unit_id)
    )
if tx_curr_de_id:
    query_strategies.append(
        (tx_curr_de_id, tx_curr_de_name, "dataElement",
         f"Meru District Hospital (exact)", meru_org_unit_id)
    )
if tx_curr_indicator_id:
    query_strategies.append(
        (tx_curr_indicator_id, tx_curr_indicator_name, "indicator",
         f"Municipality Ward (parent)", MUNICIPALITY_WARD_ID)
    )
    query_strategies.append(
        (tx_curr_indicator_id, tx_curr_indicator_name, "indicator",
         f"Imenti North Sub County", MENTI_NORTH_ID)
    )
    query_strategies.append(
        (tx_curr_indicator_id, tx_curr_indicator_name, "indicator",
         f"Meru County", MERU_COUNTY_ID)
    )

for dx_id, dx_name, dx_type, ou_label, ou_value in query_strategies:
    if found:
        break
    print(f"\n  → Trying {dx_type} '{dx_name}' at {ou_label} ...")
    found = query_and_display(dx_id, dx_name, dx_type, ou_label, ou_value)

# Final summary
print("\n" + "=" * 70)
if found:
    print(f"SUCCESS: Retrieved TX_Curr (Currently on Treatment) data for Meru District Hospital.")
else:
    print("NOTE: No TX_Curr data found for Meru District Hospital in this DHIS2 instance.")
    print("=" * 70)
    print("Possible reasons:")
    print("  - The facility may not report HIV treatment data (TX_Curr) to this DHIS2.")
    print("  - The data may be available under a different indicator/data element ID.")
    print("  - The user credentials may not have data access to Meru District Hospital.")
    print("  - The org unit path in the CSV may differ from the live server configuration.")
print("=" * 70)
