"""Find data elements for 'newly started on ART' on CHAK server."""
import requests
from requests.auth import HTTPBasicAuth

base = 'http://ereporting.chak.or.ke:8500/api'
auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')

# Search data elements for "started ART"
r = requests.get(f'{base}/dataElements', params={'filter': 'name:ilike:started ART', 'fields': 'id,name', 'paging': 'false'}, auth=auth, timeout=30)
if r.ok:
    data = r.json()
    print('=== Data Elements matching "started ART" ===')
    for de in data.get('dataElements', []):
        print(f"  DE: {de['id']}: {de['name']}")
else:
    print(f'DE error: {r.status_code}', r.text[:200])

# Search indicators for "started ART"  
r = requests.get(f'{base}/indicators', params={'filter': 'name:ilike:started ART', 'fields': 'id,name', 'paging': 'false'}, auth=auth, timeout=30)
if r.ok:
    data = r.json()
    print('\n=== Indicators matching "started ART" ===')
    for ind in data.get('indicators', []):
        print(f"  IND: {ind['id']}: {ind['name']}")
else:
    print(f'IND error: {r.status_code}', r.text[:200])

# Try to find Tx_New
r = requests.get(f'{base}/indicators', params={'filter': 'name:ilike:TX_NEW', 'fields': 'id,name', 'paging': 'false'}, auth=auth, timeout=30)
if r.ok:
    data = r.json()
    print('\n=== Indicators matching TX_NEW ===')
    for ind in data.get('indicators', []):
        print(f"  IND: {ind['id']}: {ind['name']}")
else:
    print(f'IND TX_NEW error: {r.status_code}', r.text[:200])

# Try with 'newly'
r = requests.get(f'{base}/dataElements', params={'filter': 'name:ilike:newly', 'fields': 'id,name', 'paging': 'false'}, auth=auth, timeout=30)
if r.ok:
    data = r.json()
    print('\n=== Data Elements matching "newly" ===')
    for de in data.get('dataElements', []):
        print(f"  DE: {de['id']}: {de['name']}")
else:
    print(f'DE newly error: {r.status_code}', r.text[:200])
