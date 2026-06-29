import requests, json
from requests.auth import HTTPBasicAuth

auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
base = 'http://ereporting.chak.or.ke:8500/api'

# 1. Search for data elements matching empty sub-tabs
terms = ['ART optimization', 'Adverse Event', 'DSD', 'OTZ', 'OVC', 'COVID', 'AHD', 'Treatment outcome']
print("=" * 60)
print("DATA ELEMENTS SEARCH")
print("=" * 60)
for term in terms:
    url = f'{base}/dataElements?filter=displayName:ilike:{term}&fields=id,displayName&pageSize=5'
    r = requests.get(url, auth=auth, timeout=10)
    if r.status_code == 200:
        items = r.json().get('dataElements', [])
        if items:
            print(f'\n--- {term} ---')
            for item in items:
                print(f'  {item["id"]} - {item["displayName"]}')
        # else:
        #     print(f'\n--- {term} --- (none found)')

# 2. Get all indicators
print("\n" + "=" * 60)
print("INDICATORS SEARCH")
print("=" * 60)
indicator_terms = ['TX_CURR', 'TX_NEW', 'TX_PVLS', 'IIT', 'ART', 'ADVERSE', 'OTZ', 'OVC']
for term in indicator_terms:
    url = f'{base}/indicators?filter=displayName:ilike:{term}&fields=id,displayName,numeratorDescription&pageSize=5'
    r = requests.get(url, auth=auth, timeout=10)
    if r.status_code == 200:
        items = r.json().get('indicators', [])
        if items:
            print(f'\n--- {term} ---')
            for item in items:
                print(f'  {item["id"]} - {item["displayName"]}')
                if 'numeratorDescription' in item:
                    print(f'      Num: {item["numeratorDescription"][:80]}')

# 3. Get program indicators
print("\n" + "=" * 60)
print("PROGRAM INDICATORS")
print("=" * 60)
r = requests.get(f'{base}/programIndicators?fields=id,displayName&pageSize=10', auth=auth, timeout=10)
if r.status_code == 200:
    for item in r.json().get('programIndicators', []):
        print(f'  {item["id"]} - {item["displayName"]}')

# 4. Get available data element groups (for understanding data structure)
print("\n" + "=" * 60)
print("DATA ELEMENT GROUPS (first 20)")
print("=" * 60)
r = requests.get(f'{base}/dataElementGroups?fields=id,displayName&pageSize=20', auth=auth, timeout=10)
if r.status_code == 200:
    for item in r.json().get('dataElementGroups', []):
        print(f'  {item["id"]} - {item["displayName"]}')
