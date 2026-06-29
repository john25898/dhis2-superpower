import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Query TX_CURR with category disaggregation (age/sex)
# First, find all category option combos for age/sex
url = f'{BASE}/categoryOptionCombos.json'
params = {
    'fields': 'id,name,categoryCombo[id,name]',
    'paging': 'false',
    'filter': 'name:like:years',
}
r = requests.get(url, params=params, auth=AUTH, timeout=60)
combos = r.json().get('categoryOptionCombos', [])
print(f"=== Category Option Combos with 'years' ({len(combos)} found) ===")
for co in combos[:30]:
    cc_name = co.get('categoryCombo', {}).get('name', '?')
    print(f"  {co['id']} -> {co['name']} (combo: {cc_name})")

# Now query analytics for TX_CURR with age and sex category dimensions
print("\n\n=== TX_CURR analytics with category dimensions ===")
# First get the category combo for TX_CURR
url2 = f'{BASE}/dataElements/kgzd9LfXZXq.json'
params2 = {'fields': 'id,name,categoryCombo[id,name,categories[id,name,categoryOptions[id,name]]]'}
r = requests.get(url2, params=params2, auth=AUTH, timeout=30)
de = r.json()
print(json.dumps(de, indent=2)[:3000])
