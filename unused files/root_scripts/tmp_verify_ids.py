import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Verify the correct aggregates and our wrong ones
test_ids = {
    'TX_CURR correct': 'Ft6BnYNtmIj',      # TOTAL TX_Curr
    'TX_NEW correct': 'vTTEybkXZ53',        # TX_NEW: Starting ART
    'TX_CURR current (wrong)': 'BJQlqerv0YT',
    'TX_NEW current (wrong)': 'gv7bbGesTTJ',
}

# Also find all age/sex disaggregated indicators for TX_CURR and TX_NEW
# by searching for the prefix patterns used in the dictionary
search_terms = [
    'TX_Curr STA',
    'Tx_New STA', 
    'TX_Curr <',
    'TX_Curr 1',
    'TX_Curr 5',
    'TX_Curr 10',
    'TX_Curr 15',
    'TX_Curr 20',
    'TX_Curr 25',
    'TX_Curr 30',
    'TX_Curr 35',
    'TX_Curr 40',
    'TX_Curr 45',
    'TX_Curr 50',
    'TX_Curr 55',
    'TX_Curr 60',
    'TX_Curr 65',
]

for search in search_terms:
    url = f'{BASE}/dataElements.json'
    params = {
        'filter': f'name:like:{search}',
        'fields': 'id,name',
        'paging': 'false'
    }
    r = requests.get(url, params=params, auth=AUTH, timeout=60)
    items = r.json().get('dataElements', [])
    if items:
        print(f"\n=== {search} ({len(items)} found) ===")
        for de in items:
            print(f"  {de['id']} -> {de['name']}")

# Also query analytics for the correct vs wrong aggregates
print("\n\n=== ANALYTICS VERIFICATION (Meru, LAST_12_MONTHS) ===")
analytics_url = f'{BASE}/analytics.json'
for label, dx_id in test_ids.items():
    params = {
        'dimension': [f'dx:{dx_id}', 'pe:LAST_12_MONTHS', 'ou:Y52XNJ50hYb'],
        'displayProperty': 'NAME',
    }
    r = requests.get(analytics_url, params=params, auth=AUTH, timeout=60)
    data = r.json()
    rows = data.get('rows', [])
    total = sum(float(r[-1]) for r in rows if r[-1])
    print(f"{label} ({dx_id}): {len(rows)} months, total sum={total:.0f}")
    if rows:
        print(f"  Last 3: {rows[-3:]}")
