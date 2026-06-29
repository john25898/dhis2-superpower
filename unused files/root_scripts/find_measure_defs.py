"""Find measure definitions with DAX expressions in Layout JSON."""
import json

lp = r'C:\Users\ADMIN\Documents\dhis2_superpower\CHAK_Visuals_explore\Report\Layout'
with open(lp, 'r', encoding='utf-16-le') as f:
    layout = json.load(f)

# Go through all pages, all visuals, collect every Measure expression
found = 0
for sec_idx, sec in enumerate(layout.get('sections', [])):
    pname = sec.get('displayName', '')
    for vis_idx, v in enumerate(sec.get('visualContainers', [])):
        config = v.get('config', '{}')
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except:
                continue
        sv = config.get('singleVisual', {})
        pq = sv.get('prototypeQuery', {})
        sel = pq.get('Select', [])
        for s in sel:
            mea = s.get('Measure', {})
            if mea:
                found += 1
                prop = mea.get('Property', '')
                table = mea.get('Table', '')
                expr = mea.get('Expression', {})
                if expr:
                    print(f'=== Measure: {table}.{prop} (page={pname}) ===')
                    print(json.dumps(expr, indent=2)[:800])
                    print()
                elif table and prop:
                    print(f'Ref: {table}.{prop} (no expression)')

print(f'\nTotal measure references found: {found}')
