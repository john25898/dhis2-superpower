import os
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

load_dotenv()
base = os.getenv("DHIS_BASE_URL")
s = requests.Session()
s.auth = HTTPBasicAuth(os.getenv("DHIS_USERNAME"), os.getenv("DHIS_PASSWORD"))

# Search for data elements related to TX_NEW or new on ART
params = {"fields": "id,name", "filter": "name:like:TX_NEW", "paging": "false"}
r = s.get(base + "dataElements.json", params=params, timeout=30)
if r.status_code == 200:
    items = r.json().get("dataElements", [])
    print(f"Found {len(items)} data elements with TX_NEW:")
    for it in items[:20]:
        print(f'  {it["id"]}: {it["name"]}')
else:
    print(f"Error dataElements: {r.status_code}")

# also search for New on ART
params2 = {"fields": "id,name", "filter": "name:like:New on ART", "paging": "false"}
r2 = s.get(base + "dataElements.json", params=params, timeout=30)
if r2.status_code == 200:
    items2 = r2.json().get("dataElements", [])
    print(f"\nFound {len(items2)} data elements with 'New on ART':")
    for it in items2[:20]:
        print(f'  {it["id"]}: {it["name"]}')

# Search program indicators
params3 = {"fields": "id,name", "filter": "name:like:TX_NEW", "paging": "false"}
r3 = s.get(base + "programIndicators.json", params=params3, timeout=30)
if r3.status_code == 200:
    items3 = r3.json().get("programIndicators", [])
    print(f"\nFound {len(items3)} program indicators with TX_NEW:")
    for it in items3[:20]:
        print(f'  {it["id"]}: {it["name"]}')
else:
    print(f"Error programIndicators: {r3.status_code}")

# Search indicators
params4 = {"fields": "id,name", "filter": "name:like:TX_NEW", "paging": "false"}
r4 = s.get(base + "indicators.json", params=params4, timeout=30)
if r4.status_code == 200:
    items4 = r4.json().get("indicators", [])
    print(f"\nFound {len(items4)} indicators with TX_NEW:")
    for it in items4[:20]:
        print(f'  {it["id"]}: {it["name"]}')
else:
    print(f"Error indicators: {r4.status_code}")
