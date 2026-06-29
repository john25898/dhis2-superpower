import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Search broadly for TX_Curr and Tx_New data elements
for search in ['TX_Curr', 'Tx_New', 'TX_CURR', 'TX_NEW']:
    url = f'{BASE}/dataElements.json'
    params = {
        'filter': f'name:like:{search}',
        'fields': 'id,name',
        'paging': 'false'
    }
    r = requests.get(url, params=params, auth=AUTH, timeout=60)
    items = r.json().get('dataElements', [])
    print(f"\n=== {search} ({len(items)} found) ===")
    for de in items:
        print(f"  {de['id']} -> {de['name']}")
