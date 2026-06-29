"""Analyze local CSV data structure."""
import pandas as pd

df = pd.read_csv('data/dhis/raw/hiv_newly_started_art.csv')
print('Unique dx values:', df['dx'].nunique())
print(df['dx'].value_counts().head(10))
print()
print('Unique ou values:', df['ou'].nunique())

# Check Meru District Hospital
meru = df[df['ou'] == 'uwvOG2N2Cmt']
print(f'\nRows for Meru District Hospital (uwvOG2N2Cmt): {len(meru)}')
print(meru.head(10))

# Check data by dx
print('\n=== Data by dx ===')
for dx_id in df['dx'].value_counts().head(3).index:
    subset = df[df['dx'] == dx_id]
    print(f'DX: {dx_id} - {len(subset)} rows - sum(val): {subset["value"].sum()}')
