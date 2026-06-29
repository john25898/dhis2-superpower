import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Search for TX_Curr STA data elements
for prefix in ['TX_Curr STA', 'Tx_New STA']:
    url = f'{BASE}/dataElements.json'
    params = {
        'filter': f'name:like:{prefix}',
        'fields': 'id,name',
        'paging': 'false'
    }
    r = requests.get(url, params=params, auth=AUTH, timeout=60)
    items = r.json().get('dataElements', [])
    print(f"\n=== {prefix} ({len(items)} found) ===")
    for de in items:
        print(f"  {de['id']} -> {de['name']}")
