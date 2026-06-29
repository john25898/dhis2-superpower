"""Find facilities with Tx_New data and their names."""
import pandas as pd

df = pd.read_csv('data/dhis/raw/hiv_newly_started_art.csv')

# Get Tx_New STA rows
tx_new = df[df['dx'] == 'gv7bbGesTTJ']
print(f"Total Tx_New STA rows: {len(tx_new)}")
print(f"Sum value: {tx_new['value'].sum()}")

# Unique OUs with Tx_New data
ous_with_data = tx_new['ou'].unique()
print(f"Unique OUs with Tx_New data: {len(ous_with_data)}")
print("OUs:", sorted(ous_with_data))

# Check all OUs in the data
all_ous = df['ou'].unique()
print(f"\nTotal unique OUs in file: {len(all_ous)}")

# Check some facility names
try:
    hospitals = pd.read_csv('data/dhis/processed/hospitals.csv')
    # Map IDs to names
    for ou_id in ous_with_data[:10]:
        row = hospitals[hospitals['id'] == ou_id]
        if not row.empty:
            print(f"  {ou_id} -> {row.iloc[0].get('name', '?')}")
        else:
            print(f"  {ou_id} -> (not in hospitals.csv)")
except Exception as e:
    print(f"Could not read hospitals.csv: {e}")
    # Try to read from the facility dictionary
    try:
        fac = pd.read_csv('dhis2_superpower/dictionaries/master_facilities.csv')
        for ou_id in ous_with_data[:10]:
            row = fac[fac['id'] == ou_id]
            if not row.empty:
                print(f"  {ou_id} -> {row.iloc[0].get('name', '?')}")
            else:
                print(f"  {ou_id} -> (not in master_facilities.csv)")
    except Exception as e2:
        print(f"Could not read master_facilities.csv: {e2}")
