"""Extract all PBIX visuals, measures, and visual types"""
import json, re
from collections import Counter

with open('CHAK_Visuals_explore/Report/Layout', 'rb') as f:
    raw = f.read()

text = raw.decode('utf-16-le', errors='replace')

# Find all section display names (page names)
pages = re.findall(r'"displayName":"([^"]+)"', text)
print('=== PAGES ===')
for i, p in enumerate(pages):
    print(f'  Page {i}: {p}')

# Find all visual containers with displayName and visualType
visuals = re.findall(r'"displayName":"([^"]+)".*?"visualType":"([^"]+)"', text)
print(f'\n=== VISUALS ({len(visuals)}) ===')
for v in visuals:
    print(f'  {v[0]:50s} [{v[1]}]')

# Find all measure/query references
measures = set()
for m in re.findall(r'0-Measures\.([A-Za-z0-9_]+)', text):
    measures.add(m)
print(f'\n=== MEASURES ({len(measures)}) ===')
for m in sorted(measures):
    print(f'  {m}')

# Count visual types
types = re.findall(r'"visualType":"([^"]+)"', text)
type_counts = Counter(types)
print(f'\n=== VISUAL TYPE COUNTS ===')
for t, c in type_counts.most_common():
    print(f'  {t:40s} {c}')
