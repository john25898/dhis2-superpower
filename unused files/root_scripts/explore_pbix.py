"""Extract all measures and table references from CHAK Visuals PBIX."""
import json

lp = r'C:\Users\ADMIN\Documents\dhis2_superpower\CHAK_Visuals_explore\Report\Layout'
with open(lp, 'r', encoding='utf-16-le') as f:
    layout = json.load(f)

all_refs = set()

for s in layout.get('sections', []):
    pname = s.get('displayName', '')
    if 'Duplicate' in pname:
        continue
    print(f'=== {pname} ===')
    page_refs = set()
    for v in s.get('visualContainers', []):
        vc = v.get('config', '')
        if isinstance(vc, str):
            try:
                vc = json.loads(vc)
            except:
                pass
        if not isinstance(vc, dict):
            continue

        # Get from projections.queryRef (inside singleVisual)
        sv = vc.get('singleVisual', {})
        for vals in sv.get('projections', {}).values():
            for val in vals:
                if isinstance(val, dict):
                    qr = val.get('queryRef', '')
                    if qr:
                        page_refs.add(qr)
                        all_refs.add(qr)

        # Get from prototypeQuery.Select (inside singleVisual)
        pq = sv.get('prototypeQuery', {})
        for sel in pq.get('Select', []):
            col = sel.get('Column', {})
            if col:
                prop = col.get('Property', '')
                if prop:
                    page_refs.add(prop)
                    all_refs.add(prop)
            mea = sel.get('Measure', {})
            if mea:
                prop = mea.get('Property', '')
                if prop:
                    page_refs.add(prop)
                    all_refs.add(prop)

    for r in sorted(page_refs):
        print(f'  {r}')

# Summary
print()
print('=== ALL MEASURES (from 0-Measures table) ===')
for r in sorted(all_refs):
    if r.startswith('0-Measures.'):
        print(f'  {r[len("0-Measures."):]}')

print()
print('=== ALL TABLES ===')
tables = set()
for r in all_refs:
    if '.' in r:
        tables.add(r.split('.')[0])
for t in sorted(tables):
    print(f'  {t}')

# ── DATA SOURCE ──
import os
print()
print('=== DATA SOURCE ===')
cp = os.path.join(os.path.dirname(lp), '..', 'Connections')
if os.path.exists(cp):
    with open(cp, 'r', encoding='utf-8', errors='replace') as f:
        print(f.read())
else:
    print(f'NOT FOUND: {cp}')

# ── SETTINGS ──
print('=== SETTINGS ===')
sp = os.path.join(os.path.dirname(lp), '..', 'Settings')
if os.path.exists(sp):
    with open(sp, 'r', encoding='utf-8', errors='replace') as f:
        print(f.read())
else:
    print(f'NOT FOUND: {sp}')
