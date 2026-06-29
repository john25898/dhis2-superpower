"""Check what facility-level data exists in local CSV."""
import pandas as pd

df = pd.read_csv('data/dhis/raw/hiv_newly_started_art.csv')

# What data elements are there?
print("Unique dx values:")
for v in df['dx'].unique():
    print(f"  {v}")

# Check if Tx_New total (gv7bbGesTTJ) has any data at facility-level org units
txn = df[df['dx'] == 'gv7bbGesTTJ']
print(f"\ngv7bbGesTTJ (Tx_New) rows: {len(txn)}")

# Print all unique org units with value > 0
with_data = txn[txn['value'] > 0]
print(f"Rows with value > 0: {len(with_data)}")

# The local CSV uses different ou IDs - check their values for Meru-related facilities
# Check what OU IDs map to in the hospitals/org_units data
try:
    hospitals = pd.read_csv('data/dhis/processed/hospitals.csv')
    print(f"\nhospitals.csv columns: {hospitals.columns.tolist()}")
except:
    print("\nNo hospitals.csv found or different format")
