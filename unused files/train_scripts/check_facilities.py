"""Check what's in the local CSV for Tx_New data."""
import pandas as pd

df = pd.read_csv('dhis2_superpower/dictionaries/master_facilities.csv')
print('Facilities dict columns:', df.columns.tolist())
print('Sample names:', df['name'].head(10).tolist())

# Check what the 'path' column looks like for county info
if 'path' in df.columns:
    print('\nSample paths:')
    print(df['path'].head(5).tolist())

# Check for Meru in the facility names
meru = df[df['name'].str.contains('Meru', case=False, na=False)]
print(f'\nFacilities with "Meru": {len(meru)}')
print(meru[['id', 'name', 'level']].head(20).to_string())
