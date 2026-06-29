"""Cross-reference PBIX measures with master_data_elements.csv to build the PBI dataset element map."""
import pandas as pd
import re

# Load master dictionary
de = pd.read_csv(r'c:\Users\ADMIN\Documents\dhis2_superpower\dictionaries\master_data_elements.csv')
print(f'Total data elements in dictionary: {len(de)}')

# The PBIX measures we care about (from the Viral Load Cascade + Care & Treatment pages)
pbi_measures = [
    'TX_CURR', 'TX_PVLS', 'TX_NEW', 'TX_ML', 'VL', 'PVLS', 'IIT',
    'HTS_TST', 'HTS', 'CD4', 'TPT', 'PrEP', 'PMTCT', 'CXCA', 'CACX',
    'TB_STAT', 'TB_ART', 'LINKAGE',
]

print('\n=== MAPPING PBI MEASURES → DHIS2 ELEMENTS ===')
for measure in pbi_measures:
    # Search name, displayName, shortName, description
    mask = de['name'].str.contains(measure, case=False, na=False) | \
           de['displayName'].str.contains(measure, case=False, na=False) | \
           de['shortName'].str.contains(measure, case=False, na=False)
    
    matches = de[mask]
    
    # For broad terms like VL, TB, CD4 - limit to most relevant
    if measure in ('VL', 'TB', 'CD4', 'IIT', 'HTS'):
        # Get unique elements (not disaggregated versions)
        short = matches[matches['shortName'].str.len() < 60].head(15)
    elif measure == 'TX_PVLS':
        # TX_PVLS: focus on aggregate/total elements
        agg_keywords = ['All', 'Total', 'Routine', 'Targeted']
        agg_mask = matches['name'].apply(lambda x: any(k in x for k in agg_keywords))
        short = matches[agg_mask].head(15) if agg_mask.any() else matches.head(10)
    else:
        short = matches.head(10)
    
    for _, row in short.iterrows():
        print(f"  {row['id']} | {row['name'][:70]} | short={str(row.get('shortName',''))[:40]}")
    print()

# Specifically: what elements power the Viral Load Cascade page?
print('=== VIRAL LOAD CASCADE ELEMENTS ===')
vl_pages = ['TX_CURR', 'TX_PVLS', 'VL Suppression', 'VL Uptake', 'TX_NEW']
for term in vl_pages:
    mask = de['name'].str.contains(term, case=False, na=False)
    matches = de[mask]
    print(f'\n--- {term} ({len(matches)} matches) ---')
    for _, row in matches.head(8).iterrows():
        print(f"  {row['id']} | {row['name'][:80]}")

# Also find elements that would specifically be in a "Data Element Values" table
print('\n\n=== ELEMENTS THAT LOOK LIKE AGGREGATE DATA POINTS ===')
agg_pattern = r'^(TX_|HTS_|PMTCT|PrEP|CXCA|TB_)'
mask = de['id'].str.match(agg_pattern)
agg_els = de[mask]
print(f'Aggregate-style elements: {len(agg_els)}')
for _, row in agg_els.head(30).iterrows():
    print(f"  {row['id']} | {row['name'][:80]}")
