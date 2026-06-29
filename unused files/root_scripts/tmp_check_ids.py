import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Check if any of our current IDs exist at all
all_ids = [
    'gv7bbGesTTJ','rpL7wMYNPDH','s9iBEnfSHhh','JprDjnAyB0f','PG5Ynz9xGCu',
    'SNOcc1Tq2iH','VqYNMLji5U5','wJWCrZVh1iu','jjXJNig8fxs','Lbs5RUpnwPD',
    'cQrYHDWkY2y','QRV2YRNGYJ6','Mt9G8jCODUw','FDRjPKGGVC9','ShO7o3bHsNr',
    'ivLPgJtKgcN','NBMvd95wp7t','X7QikQUsYB1','MOqDhGiw7W6','BFbmB3WxGPd',
    'BJQlqerv0YT','Q8ErsVgUUy7','P8UoaFZ9whV','CBoJcoKZ7Iy','UoCnviagVgb',
]

print("=== Checking if current IDs exist in DHIS2 ===")
for dx in all_ids:
    url = f'{BASE}/dataElements/{dx}.json'
    params = {'fields': 'id,name'}
    r = requests.get(url, params=params, auth=AUTH, timeout=30)
    if r.ok:
        de = r.json()
        print(f"  EXISTS: {de['id']} -> {de.get('name','?')}")
    else:
        print(f"  NOT FOUND: {dx} (status={r.status_code})")

# Also try the analytics API to query by data element name
print("\n\n=== Try analytics API with category disaggregation ===")
# Query analytics for TX_CURR (correct ID) with age/sex categories
url2 = f'{BASE}/analytics.json'
params2 = {
    'dimension': ['dx:kgzd9LfXZXq', 'pe:202604', 'ou:Y52XNJ50hYb'],
    'displayProperty': 'NAME',
}
r = requests.get(url2, params=params2, auth=AUTH, timeout=60)
print(json.dumps(r.json(), indent=2)[:2000])
