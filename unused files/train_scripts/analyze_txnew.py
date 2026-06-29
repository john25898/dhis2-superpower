"""Analyze local CSV for available Tx_New data."""
import pandas as pd

df = pd.read_csv('data/dhis/raw/hiv_newly_started_art.csv')

# Filter to Tx_New STA
txn = df[df['dx'] == 'gv7bbGesTTJ']
print(f"Tx_New rows: {len(txn)}")
print(f"Periods: {sorted(txn['pe'].unique())}")
print(f"Sum value: {txn['value'].sum()}")

# Group by period
by_period = txn.groupby('pe')['value'].sum()
print("\nBy period:")
print(by_period)

# Top 10 OUs by value
top_ou = txn.groupby('ou')['value'].sum().sort_values(ascending=False).head(10)
print("\nTop OUs by Tx_New value:")
# Try to map to names
try:
    hospitals = pd.read_csv('dhis2_superpower/dictionaries/master_facilities.csv')
    for ou_id, val in top_ou.items():
        match = hospitals[hospitals['id'] == ou_id]
        name = match.iloc[0]['name'] if not match.empty else '?'
        print(f"  {name} ({ou_id}): {val}")
except Exception as e:
    print(f"Could not map names: {e}")
    print(top_ou)
