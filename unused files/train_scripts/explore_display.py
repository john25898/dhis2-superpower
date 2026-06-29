import pandas as pd
import json

# Load metadata
de = pd.read_csv("data/dhis/meta/data_elements.csv")
de_map = dict(zip(de["id"], de["name"]))
orgs = pd.read_csv("data/dhis/meta/organisation_units.csv")
org_map = dict(zip(orgs["id"], orgs["name"]))

# Load raw data
df = pd.read_csv("data/dhis/raw/hiv_newly_started_art.csv")
nonzero = df[df["value"] > 0]

# Group by dx and period to get monthly breakdown by indicator
dx_period = nonzero.groupby(["dx", "pe"])["value"].sum().reset_index()

# Find the main data elements (Tx_New variants)
tx_new_elements = de[de["name"].str.contains("Tx_New|TX_NEW|TX New", case=False, na=False)]
print("=== Tx_New related data elements ===")
for _, r in tx_new_elements.iterrows():
    print(f"  {r['id']} | {r['name']}")

print()

# Check the display export for predefined chart configurations
dd = pd.read_csv("data/dhis/processed/hiv_newly_started_art_display_export.csv")
print("=== Display Export ===")
print(f"Shape: {dd.shape}")
print(f"Record types: {dd['record_type'].unique()}")
print()

# Look at chart records
charts = dd[dd["record_type"] == "chart"]
print(f"Charts: {len(charts)}")
for _, r in charts.iterrows():
    print(f"  {r['chart_id']} | {r['chart_title']} | src={r['source_file']}")

# Look at data records
data_records = dd[dd["record_type"] == "data"]
print(f"\nData records: {len(data_records)}")
print(data_records.head(20).to_string())
