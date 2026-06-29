"""Extract per-page visual breakdown from PBIX Layout"""
import re

with open('CHAK_Visuals_explore/Report/Layout', 'rb') as f:
    raw = f.read()
text = raw.decode('utf-16-le', errors='replace')

# Find section boundaries by looking for section/displayName patterns
# Each section has: "displayName\":"PageName"
# After each section, captures visual types until the next section

# Find all section positions with their names
section_pattern = r'displayName\\":\\"([^\\]+)'
sections = list(re.finditer(section_pattern, text))

print(f"Total sections/pages: {len(sections)}")

# For each section, look at visual types in the surrounding content
for i, s in enumerate(sections):
    name = s.group(1)
    
    # Determine section range: from this position to next section or end
    start = s.start()
    if i + 1 < len(sections):
        end = sections[i+1].start()
    else:
        end = len(text)
    
    chunk = text[start:end]
    
    # Count visual types in this section
    vis_types = re.findall(r'visualType\\":\\"([^\\]+)', chunk)
    from collections import Counter
    vc = Counter(vis_types)
    
    # Count distinct measures referenced
    measures = set(re.findall(r'0-Measures\.([A-Za-z0-9_]+)', chunk))
    
    print(f"\n--- Page {i}: {name} ---")
    print(f"  Visual types:")
    for vt, cnt in vc.most_common():
        print(f"    {vt}: {cnt}")
    print(f"  Measures ({len(measures)}):")
    for m in sorted(measures)[:20]:
        print(f"    {m}")
    if len(measures) > 20:
        print(f"    ... and {len(measures)-20} more")

# Now specifically look at LineClusteredColumnComboChart (most common type)
# Find their display names
print("\n\n=== DETAILS FOR KEY CHARTS ===")

# LineClusteredColumnComboChart
lccc = list(re.finditer(r'visualType\\":\\"lineClusteredColumnComboChart\\"', text))
print(f"\nLineClusteredColumnComboChart instances: {len(lccc)}")
for i, m in enumerate(lccc[:20]):
    chunk = text[max(0,m.start()-500):m.start()]
    # Find displayName backwards
    names = re.findall(r'displayName\\":\\"([^\\]+)', chunk)
    if names:
        print(f"  {i}: {names[-1]}")
    else:
        print(f"  {i}: (no displayName found)")

# PivotTable
pt = list(re.finditer(r'visualType\\":\\"pivotTable\\"', text))
print(f"\nPivotTable instances: {len(pt)}")
for i, m in enumerate(pt):
    chunk = text[max(0,m.start()-500):m.start()]
    names = re.findall(r'displayName\\":\\"([^\\]+)', chunk)
    print(f"  {i}: {names[-1] if names else '(unnamed)'} - Page around this pos...")

# Funnel
funnel = list(re.finditer(r'visualType\\":\\"funnel\\"', text))
print(f"\nFunnel instances: {len(funnel)}")
for i, m in enumerate(funnel):
    chunk = text[max(0,m.start()-500):m.start()]
    names = re.findall(r'displayName\\":\\"([^\\]+)', chunk)
    print(f"  {i}: {names[-1] if names else '(unnamed)'}")

# hundredPercentStackedColumnChart
hpcc = list(re.finditer(r'visualType\\":\\"hundredPercentStackedColumnChart\\"', text))
print(f"\nHundredPercentStackedColumn instances: {len(hpcc)}")
for i, m in enumerate(hpcc):
    chunk = text[max(0,m.start()-500):m.start()]
    names = re.findall(r'displayName\\":\\"([^\\]+)', chunk)
    print(f"  {i}: {names[-1] if names else '(unnamed)'}")

# hundredPercentStackedBarChart
hpbc = list(re.finditer(r'visualType\\":\\"hundredPercentStackedBarChart\\"', text))
print(f"\nHundredPercentStackedBar instances: {len(hpbc)}")
for i, m in enumerate(hpbc):
    chunk = text[max(0,m.start()-500):m.start()]
    names = re.findall(r'displayName\\":\\"([^\\]+)', chunk)
    print(f"  {i}: {names[-1] if names else '(unnamed)'}")

# lineStackedColumnComboChart
lscc = list(re.finditer(r'visualType\\":\\"lineStackedColumnComboChart\\"', text))
print(f"\nLineStackedColumnCombo instances: {len(lscc)}")
for i, m in enumerate(lscc):
    chunk = text[max(0,m.start()-500):m.start()]
    names = re.findall(r'displayName\\":\\"([^\\]+)', chunk)
    print(f"  {i}: {names[-1] if names else '(unnamed)'}")

# shapeMap
sm = list(re.finditer(r'visualType\\":\\"shapeMap\\"', text))
print(f"\nShapeMap instances: {len(sm)}")
for i, m in enumerate(sm):
    chunk = text[max(0,m.start()-500):m.start()]
    names = re.findall(r'displayName\\":\\"([^\\]+)', chunk)
    print(f"  {i}: {names[-1] if names else '(unnamed)'}")

# azureMap
am = list(re.finditer(r'visualType\\":\\"azureMap\\"', text))
print(f"\nAzureMap instances: {len(am)}")
for i, m in enumerate(am):
    chunk = text[max(0,m.start()-500):m.start()]
    names = re.findall(r'displayName\\":\\"([^\\]+)', chunk)
    print(f"  {i}: {names[-1] if names else '(unnamed)'}")
