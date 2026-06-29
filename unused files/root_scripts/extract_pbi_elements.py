"""Extract the Sum(Data Element Values.Value) table from PBIX DataModel."""
import re, os

dm_path = r'C:\Users\ADMIN\Documents\dhis2_superpower\CHAK_Visuals_explore\DataModel'
dm = open(dm_path, 'rb').read()
txt = dm.decode('utf-16-le', errors='replace')

# Strategy: search for table name patterns
searches = [
    'Sum(Data Element Values',
    'Data Element Values',
    'Data Element Value',
    '"Census"',
    '0-Measures',
]

for s in searches:
    idx = txt.find(s)
    if idx >= 0:
        start = max(0, idx - 300)
        end = min(len(txt), idx + 8000)
        snippet = txt[start:end]
        print(f'=== "{s}" at offset {idx} ===')
        # Clean output - keep readable parts
        clean = ''.join(c if c.isprintable() or c in '\n\r\t' else ' ' for c in snippet)
        print(clean[:6000])
        print()
    else:
        print(f'--- "{s}" NOT FOUND ---')
        print()

# Find all table definitions in the model
print('=== ALL TABLE DEFINITIONS ===')
for m in re.finditer(r'"name"\s*:\s*"([^"]{3,80})"\s*,\s*"type"\s*:\s*"table"', txt):
    tname = m.group(1)
    if 'Min(' not in tname and 'Count' not in tname and 'Sum(' not in tname:
        print(f'  Table: {tname}')

# Find all column names that look like DHIS2 UIDs (11-char alphanumeric)
print()
print('=== DHIS2 UIDs found in DataModel ===')
uids = set()
for m in re.finditer(r'[a-zA-Z][a-zA-Z0-9]{10}', txt):
    uid = m.group()
    # Validate: 11 chars, starts with letter
    if uid[0].isalpha() and uid[0].isascii():
        uids.add(uid)

for uid in sorted(uids):
    print(f'  {uid}')
