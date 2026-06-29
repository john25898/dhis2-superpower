import requests, json
from requests.auth import HTTPBasicAuth

auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
base = 'http://ereporting.chak.or.ke:8500/api'

# 1. Find datasets that contain "JTP" or "Jamii" or "Tekelezi"
print("=" * 60)
print("DATASETS SEARCH")
print("=" * 60)
terms = ['JTP', 'Jamii', 'Tekelezi', 'Stawisha', 'Care and Treatment']
for term in terms:
    url = f'{base}/dataSets?filter=displayName:ilike:{term}&fields=id,displayName,periodType&pageSize=10'
    r = requests.get(url, auth=auth, timeout=10)
    if r.status_code == 200:
        items = r.json().get('dataSets', [])
        if items:
            print(f'\n--- {term} ---')
            for item in items:
                print(f'  {item["id"]} - {item["displayName"]} ({item.get("periodType","N/A")})')

# 2. Get ALL data elements for JTP/Stawisha
print("\n" + "=" * 60)
print("ALL JTP/STAWISHA DATA ELEMENTS")
print("=" * 60)
jtp_terms = ['JTP', 'C&T (facility)', 'C&T (KeyPop)', 'TX_Curr', 'TX_New', 'TX_CURR', 'TX_NEW', 
             'ART Regimen', 'VL ', 'PVLS', 'IIT', 'MMD', 'OTZ', 'OVC', 'AHD',
             'PREP', 'HTS', 'PITC', 'PNS', 'INDEX', 'Linkage',
             'Stawisha CT', 'Stawisha HTS']
seen = set()
for term in jtp_terms:
    url = f'{base}/dataElements?filter=displayName:ilike:{term}&fields=id,displayName,code&pageSize=20'
    r = requests.get(url, auth=auth, timeout=10)
    if r.status_code == 200:
        items = r.json().get('dataElements', [])
        for item in items:
            if item['id'] not in seen:
                seen.add(item['id'])
                print(f'  {item["id"]} | {item.get("code","")} | {item["displayName"]}')

# 3. Get programs
print("\n" + "=" * 60)
print("PROGRAMS")
print("=" * 60)
for term in ['JTP', 'Stawisha', 'Jamii']:
    r = requests.get(f'{base}/programs?filter=displayName:ilike:{term}&fields=id,displayName,programType&pageSize=10', auth=auth, timeout=10)
    if r.status_code == 200:
        for p in r.json().get('programs', []):
            print(f'  {p["id"]} - {p["displayName"]} ({p.get("programType","N/A")})')

# 4. Get dashboard items for JTP dashboards
print("\n" + "=" * 60)
print("JTP DASHBOARD ITEMS")
print("=" * 60)
r = requests.get(f'{base}/dashboards?filter=displayName:ilike:JTP&fields=id,displayName,dashboardItems[id,type,visualization[id,displayName,type],shape,width,height]&pageSize=5', auth=auth, timeout=10)
if r.status_code == 200:
    for db in r.json().get('dashboards', []):
        print(f'Dashboard: {db["displayName"]} ({db["id"]})')
        for item in db.get('dashboardItems', []):
            viz = item.get('visualization', {})
            print(f'  Item type={item.get("type")} viz={viz.get("id","")} {viz.get("displayName","")} ({viz.get("type","")})')

# 5. Check existing superpower data elements used
print("\n" + "=" * 60)
print("CURRENT DATA ELEMENTS IN app.py")
print("=" * 60)
import re
with open('app.py', 'r') as f:
    content = f.read()
# Find all DHIS2 data element IDs
ids = re.findall(r'"[A-Z][a-zA-Z0-9]{10}"', content)
for i, did in enumerate(sorted(set(ids))):
    # Look up each
    r2 = requests.get(f'{base}/dataElements/{did.strip(chr(34))}?fields=id,displayName,code', auth=auth, timeout=10)
    if r2.status_code == 200:
        de = r2.json()
        print(f'  {de["id"]} | {de.get("code","N/A")} | {de["displayName"]}')
