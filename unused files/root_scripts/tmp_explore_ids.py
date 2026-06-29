import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Look up what our current wrong IDs actually are
wrong_tx_new = ['gv7bbGesTTJ','rpL7wMYNPDH','s9iBEnfSHhh','JprDjnAyB0f','PG5Ynz9xGCu']
wrong_tx_curr = ['BJQlqerv0YT','Q8ErsVgUUy7','P8UoaFZ9whV','CBoJcoKZ7Iy','UoCnviagVgb']

print("=== What our current IDs actually are ===")
for label, ids in [('TX_NEW', wrong_tx_new), ('TX_CURR', wrong_tx_curr)]:
    print(f"\n--- {label} ---")
    for dx in ids:
        url = f'{BASE}/dataElements/{dx}.json'
        params = {'fields': 'id,name,shortName,code'}
        r = requests.get(url, params=params, auth=AUTH, timeout=30)
        if r.ok:
            de = r.json()
            print(f"  {de['id']} -> {de.get('name','?')}")

# Now search for all C&T data elements with age bands
# The pattern might be "TX_Curr STA" or similar
print("\n\n=== Searching for all data elements containing 'TX_Curr' OR 'TX_NEW' that have age in name ===")
url = f'{BASE}/dataElements.json'
params = {
    'filter': ['name:like:TX_Curr', 'name:like:STA'],
    'fields': 'id,name',
    'paging': 'false',
    'rootJunction': 'OR'
}
# Actually let me just search for names containing both patterns
# Use a more targeted approach
for search in ['TX_Curr <', 'TX_Curr 1-', 'TX_Curr 5-', 'TX_Curr 10', 'TX_Curr 15', 'TX_Curr 20', 'TX_Curr 25',
               'TX_NEW <', 'TX_NEW 1-', 'TX_NEW 5-', 'TX_NEW 10', 'TX_NEW 15', 'TX_NEW 20', 'TX_NEW 25',
               'Tx_New <', 'Tx_New 1-', 'Tx_New 5-', 'Tx_New 10', 'Tx_New 15', 'Tx_New 20', 'Tx_New 25',
               'TX_New <', 'TX_New 1-', 'TX_New 5-', 'TX_New 10', 'TX_New 15', 'TX_New 20', 'TX_New 25']:
    params = {
        'filter': f'name:like:{search}',
        'fields': 'id,name',
        'paging': 'false'
    }
    r = requests.get(f'{BASE}/dataElements.json', params=params, auth=AUTH, timeout=60)
    items = r.json().get('dataElements', [])
    if items:
        print(f"\n--- {search} ({len(items)} found) ---")
        for de in items:
            print(f"  {de['id']} -> {de['name']}")
