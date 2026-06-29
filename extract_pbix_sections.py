"""Find page-level sections in PBIX Layout"""
import re

with open('CHAK_Visuals_explore/Report/Layout', 'rb') as f:
    raw = f.read()
text = raw.decode('utf-16-le', errors='replace')

# Find sections property
idx = text.find('"sections"')
if idx > 0:
    print('Found "sections" at position', idx)
    # Get ~30KB around sections
    chunk = text[idx:idx+30000]
    # Find section names near 'name' keys
    names = re.findall(r'"name"\s*:\s*"([A-Za-z0-9_ -]+)"', chunk)
    print('Section names found:')
    for n in names:
        print(f'  {n}')
    print(f'Total: {len(names)}')
