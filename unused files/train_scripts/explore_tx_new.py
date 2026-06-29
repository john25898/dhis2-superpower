import pandas as pd

# Look at the raw data more closely
df = pd.read_csv("data/dhis/raw/hiv_newly_started_art.csv")
print(f"Total rows: {len(df)}")
print(f"Unique dx (data elements): {df['dx'].nunique()}")
print(f"Unique pe (periods): {sorted(df['pe'].unique())}")
print(f"Unique ou (org units): {df['ou'].nunique()}")
print(f"Value range: {df['value'].min()} - {df['value'].max()}")
print()

# Count non-zero values
nonzero = df[df["value"] > 0]
print(f"Non-zero values: {len(nonzero)} ({len(nonzero)/len(df)*100:.1f}%)")
print()

# Load org unit names
orgs = pd.read_csv("data/dhis/meta/organisation_units.csv")
org_map = dict(zip(orgs["id"], orgs["name"]))

# Load data element names
de = pd.read_csv("data/dhis/meta/data_elements.csv")
de_map = dict(zip(de["id"], de["name"]))

# Top facilities by non-zero count
print("=== Top 10 facilities by non-zero TX_NEW entries ===")
top_facs = nonzero["ou"].value_counts().head(10)
for ou_id, count in top_facs.items():
    name = org_map.get(ou_id, "UNKNOWN")
    total_val = nonzero[nonzero["ou"]==ou_id]["value"].sum()
    print(f"  {name}: {count} entries, total={int(total_val)}")

print()
print("=== Top data elements (indicators) ===")
top_dx = nonzero["dx"].value_counts().head(10)
for dx_id, count in top_dx.items():
    name = de_map.get(dx_id, dx_id)
    print(f"  {name}: {count} entries")

# Also check the chart values file for full picture
print()
print("=== Chart Values (aggregate monthly) ===")
cv = pd.read_csv("data/dhis/processed/hiv_newly_started_art_chart_values.csv")
print(cv.to_string())
