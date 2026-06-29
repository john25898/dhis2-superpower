"""Debug: check what's in source datasets."""
import sys, os
# Make sure we import the MAIN app.py, not dhis2_superpower/app.py
sys.path = [p for p in sys.path if 'dhis2_superpower' not in p]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import create_app
app = create_app()
sds = app.config.get('SOURCE_DATASETS', {})
print('SOURCE_DATASETS keys:', list(sds.keys()))
if 'hiv_newly_started_art.csv' in sds:
    df = sds['hiv_newly_started_art.csv']
    print('DataFrame shape:', df.shape)
    print('Columns:', list(df.columns))
    print('Sample rows:')
    print(df.head(3))
    print()
    print('Unique Counties:', df['County'].dropna().unique()[:10])
    print('Unique Facilities:', df['Facility'].dropna().unique()[:10])
    print('Unique Months:', sorted(df['Month'].dropna().unique())[:10])
else:
    print('NOT FOUND in SOURCE_DATASETS')
    df = app.config.get('DATAFRAME')
    if df is not None:
        if 'source_file' in df.columns:
            match = df[df['source_file'] == 'hiv_newly_started_art.csv']
            print(f'Main DF rows with source hiv_newly_started_art: {len(match)}')
