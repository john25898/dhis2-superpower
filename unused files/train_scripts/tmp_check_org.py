import pandas as pd
ou = pd.read_csv("data/dhis/meta/organisation_units.csv")

# Trace hierarchy for Kikuyu Ward
sample = ou[ou["id"] == "cbYznphRVBi"].iloc[0]
print("Kikuyu Ward path:", sample["path"])
parts = sample["path"].split("/")
print("\nHierarchy:")
for p in parts[1:]:
    row = ou[ou["id"] == p]
    if len(row):
        r = row.iloc[0]
        print(f"  Level {r['level']}: {r['name']}")

print("\n---")
# Also check top-level root
root = ou[ou["id"] == parts[1]]
if len(root):
    r = root.iloc[0]
    print(f"\nRoot org unit: {r['name']}")

# Check what org units exist at level 1
level1 = ou[ou["level"] == 1]
print(f"\nLevel 1 org units ({len(level1)}):")
for _, r in level1.iterrows():
    print(f"  {r['name']} ({r['id']})")
