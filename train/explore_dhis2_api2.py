import requests, json
from requests.auth import HTTPBasicAuth

auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
base = 'http://ereporting.chak.or.ke:8500/api'

# 1. Broader search for ART-related data elements
print("=" * 60)
print("ART/REGIMEN DATA ELEMENTS")
print("=" * 60)
terms = ['ART regimen', 'ART optimization', '1st line', '2nd line', 'DTG']
for term in terms:
    url = f'{base}/dataElements?filter=displayName:ilike:{term}&fields=id,displayName&pageSize=5'
    r = requests.get(url, auth=auth, timeout=10)
    if r.status_code == 200:
        items = r.json().get('dataElements', [])
        if items:
            print(f'\n--- {term} ---')
            for item in items:
                print(f'  {item["id"]} - {item["displayName"]}')

# 2. Look for TB/COVID/AHD categories more broadly
print("\n" + "=" * 60)
print("AHD SPECIFIC DATA")
print("=" * 60)
terms2 = ['AHD', 'WHO stage', 'CD4 count', 'Cryptococcal', 'TB screening']
for term in terms2:
    url = f'{base}/dataElements?filter=displayName:ilike:{term}&fields=id,displayName&pageSize=5'
    r = requests.get(url, auth=auth, timeout=10)
    if r.status_code == 200:
        items = r.json().get('dataElements', [])
        if items:
            print(f'\n--- {term} ---')
            for item in items:
                print(f'  {item["id"]} - {item["displayName"]}')

# 3. Search the full data element group
print("\n" + "=" * 60)
print("DATA ELEMENT GROUPS - FULL LIST")
print("=" * 60)
r = requests.get(f'{base}/dataElementGroups?fields=id,displayName&pageSize=50', auth=auth, timeout=10)
if r.status_code == 200:
    for item in r.json().get('dataElementGroups', []):
        print(f'  {item["id"]} - {item["displayName"]}')

# 4. Check what category combos exist
print("\n" + "=" * 60)
print("CATEGORY COMBOS")
print("=" * 60)
r = requests.get(f'{base}/categoryCombos?fields=id,displayName&pageSize=20', auth=auth, timeout=10)
if r.status_code == 200:
    for item in r.json().get('categoryCombos', []):
        print(f'  {item["id"]} - {item["displayName"]}')

# 5. Org unit levels
print("\n" + "=" * 60)
print("ORG UNIT LEVELS")
print("=" * 60)
r = requests.get(f'{base}/organisationUnitLevels?fields=id,level,displayName&pageSize=20', auth=auth, timeout=10)
if r.status_code == 200:
    for item in r.json().get('organisationUnitLevels', []):
        print(f'  Level {item["level"]} - {item["displayName"]}')

# 6. Check available visualization types
print("\n" + "=" * 60)
print("VISUALIZATIONS (first 10)")
print("=" * 60)
r = requests.get(f'{base}/visualizations?fields=id,displayName,type&pageSize=10', auth=auth, timeout=10)
if r.status_code == 200:
    for item in r.json().get('visualizations', []):
        print(f'  {item["id"]} - {item["displayName"]} ({item.get("type", "N/A")})')

# 7. Check what indicators exist in important categories
print("\n" + "=" * 60)
print("IMPORTANT INDICATORS (broader search)")
print("=" * 60)
r = requests.get(f'{base}/indicators?fields=id,displayName,numerator&pageSize=30', auth=auth, timeout=10)
if r.status_code == 200:
    for item in r.json().get('indicators', []):
        name = item['displayName']
        if any(kw in name.upper() for kw in ['TX_CURR', 'TX_NEW', 'TX_PVLS', 'IIT', 'LINKAGE', 'POSITIVITY', 'ADHERENCE', 'SUPPRESSION']):
            print(f'  {item["id"]} - {name}')
