"""Extract all visual elements (charts/tables) from CHAK PBIX by section."""
import json

lp = r'C:\Users\ADMIN\Documents\dhis2_superpower\CHAK_Visuals_explore\Report\Layout'
with open(lp, 'r', encoding='utf-16-le') as f:
    layout = json.load(f)

# Pages we care about
target_pages = [
    'HTS performance',
    'HTS Index Testing',
    'SNS Cascade',
    'Care and Treatment',
    'CD4_TPT Uptake',
    'Viral Load Cascade',
    'Key Indicators Drill Down',
    'HTS Summary',
    'Testing Modality',
]

page_map = {}
for s in layout.get('sections', []):
    pname = s.get('displayName', '')
    if 'Duplicate' in pname:
        continue
    page_map[pname] = s

for pname in target_pages:
    s = page_map.get(pname)
    if not s:
        print(f'=== {pname} === NOT FOUND')
        continue
    print(f'\n{"="*60}')
    print(f'=== {pname} ===')
    print(f'{"="*60}')
    
    for idx, v in enumerate(s.get('visualContainers', [])):
        vc = v.get('config', '')
        if isinstance(vc, str):
            try:
                vc = json.loads(vc)
            except:
                continue
        if not isinstance(vc, dict):
            continue
        
        sv = vc.get('singleVisual', {})
        
        # Get visual type
        vis_type = sv.get('visualType', 'unknown')
        
        # Get position/size
        pos = sv.get('visualContainer', vc.get('position', {}))
        
        # Get projections (fields used)
        proj = sv.get('projections', {})
        fields = {}
        for role, vals in proj.items():
            if isinstance(vals, list):
                for val in vals:
                    if isinstance(val, dict):
                        qr = val.get('queryRef', '')
                        if qr:
                            fields.setdefault(role, []).append(qr)
        
        # Get filters
        filters = []
        for filt in vc.get('filters', []):
            if isinstance(filt, dict):
                f_target = filt.get('target', {})
                if isinstance(f_target, dict):
                    table = f_target.get('table', '')
                    col = f_target.get('column', '')
                    if table or col:
                        filters.append(f'{table}.{col}')
        
        print(f'\n  Visual #{idx}: type={vis_type}')
        if fields:
            for role, refs in fields.items():
                print(f'    {role}: {", ".join(refs[:3])}{"..." if len(refs) > 3 else ""}')
        if filters:
            print(f'    filters: {", ".join(filters[:3])}')
