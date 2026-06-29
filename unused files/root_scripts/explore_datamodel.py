"""Try to extract measure definitions from PBIX DataModel and Metadata."""
import os

dm_path = r'C:\Users\ADMIN\Documents\dhis2_superpower\CHAK_Visuals_explore\DataModel'
md_path = r'C:\Users\ADMIN\Documents\dhis2_superpower\CHAK_Visuals_explore\Metadata'
ver_path = r'C:\Users\ADMIN\Documents\dhis2_superpower\CHAK_Visuals_explore\Version'

# Version
print('=== VERSION ===')
print(open(ver_path, 'r', encoding='utf-8', errors='replace').read())

# Metadata - UTF-16LE
print('=== METADATA ===')
raw = open(md_path, 'rb').read()
text = raw.decode('utf-16-le', errors='replace')
# Print first 5000 chars
print(text[:5000])

print()
print('=== METADATA (key portions) ===')
# Look for patterns like table names, measure names
import re
found = set()
for m in re.finditer(r'[\x20-\x7E]{4,}', text):
    found.add(m.group())
for item in sorted(found):
    if any(kw in item.lower() for kw in ['measure', 'table', 'dax', 'tx_curr', 'tx_new', 'tx_pvls', 'tx_ml', 'census', 'format', 'string', 'int64', 'decimal']):
        print(f'  {item}')

# DataModel - try reading as plain text to find if there's readable content
print()
print('=== DATAMODEL READABLE CONTENT (first 2000 chars) ===')
with open(dm_path, 'rb') as f:
    raw_dm = f.read()

# Try UTF-16LE decode
text_dm = raw_dm[:10000].decode('utf-16-le', errors='replace')
print(text_dm[:2000])

# Try to find DAX expressions
print()
print('=== DAX EXPRESSIONS ===')
# Search for common DAX patterns
dax_patterns = [
    (r'(?:CALCULATE|SUMX|FILTER|DIVIDE|IF|SWITCH|VALUES|DISTINCT|COUNTROWS|SUM|COUNT|AVERAGE|MAX|MIN|ALL|ALLEXCEPT|KEEPFILTERS|USERELATIONSHIP|TOTALYTD|TOTALQTD|SAMEPERIODLASTYEAR|DATEADD|DATESYTD|DATESQTD|DATESMTD|PREVIOUSMONTH|PREVIOUSQUARTER|PREVIOUSYEAR|FORMAT|VAR|RETURN)\s*\(',
    r'[A-Za-z_][A-Za-z_0-9]*\s*[:=]\s*(?:CALCULATE|SUM|COUNT|DIVIDE|IF|SWITCH|VAR)',
    r'"(?:TX_CURR|TX_NEW|TX_PVLS|TX_ML|VL|IIT|CD4|HTS|PrEP|TPT|TB)[^"]*"\s*[:=]',
]

for i, pat in enumerate(dax_patterns):
    matches = re.finditer(pat, text_dm, re.IGNORECASE)
    for m in matches:
        start = max(0, m.start()-50)
        end = min(len(text_dm), m.end()+150)
        snippet = text_dm[start:end]
        print(f'  [{i}] ...{snippet}...')
        print()
