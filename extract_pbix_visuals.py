"""Extract visual types from PBIX Layout more carefully"""
import json, re
from collections import Counter

with open('CHAK_Visuals_explore/Report/Layout', 'rb') as f:
    raw = f.read()

text = raw.decode('utf-16-le', errors='replace')

# Extract all visualType values directly
types = re.findall(r'"visualType":"([^"]+)"', text)
type_counts = Counter(types)
print('=== VISUAL TYPE COUNTS ===')
for t, c in type_counts.most_common():
    print(f'  {t:40s} {c}')

# Extract sections with their visual types
# Find section boundaries first
sections = re.findall(r'"id":"[^"]+","displayName":"([^"]+?)"', text)
print(f'\n=== SECTIONS (PAGES) FOUND: {len(sections)} ===')
for i, s in enumerate(sections):
    # Get visual types within ~200 chars of section name
    idx = text.find(s)
    chunk = text[idx:idx+5000]  # Look ahead 5000 chars
    vis_types_in_section = re.findall(r'"visualType":"([^"]+)"', chunk)
    vc = Counter(vis_types_in_section)
    print(f'  Page {i}: {s}')
    for vt, cnt in vc.most_common():
        print(f'      {vt}: {cnt}')

# Find all visual display names
print(f'\n=== ALL VISUAL DISPLAY NAMES ===')
# Try pattern: "name":"value" within a section/visual group
for m in re.finditer(r'"displayName"\s*:\s*"([^"]+)"', text):
    print(f'  DisplayName: {m.group(1)}')
