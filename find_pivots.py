import re

with open('CHAK_Visuals_explore/Report/Layout', 'r', encoding='utf-16-le') as f:
    content = f.read()

pattern = r'visualType\\":\\"pivotTable\\"'
matches = list(re.finditer(pattern, content))
print(f'Found {len(matches)} pivotTable visuals')

# For each, extract the sectionId and displayName
for i, m in enumerate(matches):
    start = max(0, m.start() - 500)
    end = min(len(content), m.end() + 500)
    ctx = content[start:end]
    
    # Find sectionId
    sn = re.search(r'sectionId\\":\\"([^\\]+)', ctx)
    dn = re.search(r'displayName\\":\\"([^\\]+)', ctx)
    sn2 = re.search(r'name\\":\\"([^\\]+(?:Page|page|Dashboard)[^\\]*)', ctx)
    
    print(f'\n--- PivotTable #{i+1} ---')
    if sn: print(f'  Section: {sn.group(1)}')
    if dn: print(f'  DisplayName: {dn.group(1)}')
    if sn2: print(f'  Name: {sn2.group(1)}')
