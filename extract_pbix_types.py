"""Extract visual types from PBIX Layout"""
import re
from collections import Counter

with open('CHAK_Visuals_explore/Report/Layout', 'rb') as f:
    raw = f.read()
text = raw.decode('utf-16-le', errors='replace')

types = re.findall(r'visualType\\":\\"([^\\]+)', text)
type_counts = Counter(types)
print('=== VISUAL TYPE COUNTS ===')
for t, c in type_counts.most_common():
    print(f'  {t:40s} {c}')

print(f'\nTotal visuals: {sum(type_counts.values())}')
print(f'Unique types: {len(type_counts)}')
