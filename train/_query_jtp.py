import requests, json
from requests.auth import HTTPBasicAuth

auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
base = 'http://ereporting.chak.or.ke:8500/api'

# 1. Get JTP Care and Treatment dataset data elements
print("=" * 80)
print("JTP Monthly HIV Care and Treatment - Data Elements")
print("=" * 80)
r = requests.get(f'{base}/dataSets/rPmJUQOlmpW?fields=id,displayName,periodType,dataElements[id,displayName,code]', auth=auth, timeout=60)
d = r.json()
des = d.get('dataElements', [])
print(f'Total data elements: {len(des)}')
for de in des:
    print(f'  {de["id"]} | {de.get("code","")} | {de["displayName"]}')

# 2. Also get data element groups for Care and Treatment
print("\n" + "=" * 80)
print("Data Element Groups - Care and Treatment (a30r8a8ui00)")
print("=" * 80)
r2 = requests.get(f'{base}/dataElementGroups/a30r8a8ui00?fields=id,displayName,dataElements[id,displayName,code]', auth=auth, timeout=60)
dg = r2.json()
print(f'Group: {dg["displayName"]} ({dg["id"]})')
for de in dg.get('dataElements', []):
    print(f'  {de["id"]} | {de.get("code","")} | {de["displayName"]}')

# 3. Get Stawisha CT group
print("\n" + "=" * 80)
print("Data Element Groups - Stawisha CT (J53JVUorZcZ)")
print("=" * 80)
r3 = requests.get(f'{base}/dataElementGroups/J53JVUorZcZ?fields=id,displayName,dataElements[id,displayName,code]', auth=auth, timeout=60)
dg3 = r3.json()
print(f'Group: {dg3["displayName"]} ({dg3["id"]})')
for de in dg3.get('dataElements', []):
    print(f'  {de["id"]} | {de.get("code","")} | {de["displayName"]}')
