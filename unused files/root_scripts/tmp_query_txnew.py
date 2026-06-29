import os
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

load_dotenv()
base = os.getenv("DHIS_BASE_URL")
s = requests.Session()
s.auth = HTTPBasicAuth(os.getenv("DHIS_USERNAME"), os.getenv("DHIS_PASSWORD"))

# TX_NEW: Starting ART for Meru County in June 2025
dx = "vTTEybkXZ53"  # TX_NEW: Starting ART
ou = "Y52XNJ50hYb"  # Meru County
pe = "202506"        # June 2025

url = f"{base}analytics.json?dimension=dx:{dx}&dimension=ou:{ou}&dimension=pe:{pe}"
print(f"URL: {url}")

r = s.get(url, timeout=45)
print(f"Status: {r.status_code}")

if r.status_code == 200:
    data = r.json()
    headers = [h.get("name") for h in data.get("headers", [])]
    rows = data.get("rows", [])
    meta = data.get("metaData", {}).get("items", {})
    
    print(f"Headers: {headers}")
    print(f"Rows: {len(rows)}")
    
    total = 0
    for row in rows:
        dx_name = meta.get(row[0], {}).get("name", row[0]) if len(row) > 0 else ""
        ou_name = meta.get(row[1], {}).get("name", row[1]) if len(row) > 1 else ""
        pe_name = meta.get(row[2], {}).get("name", row[2]) if len(row) > 2 else ""
        val = float(row[3]) if len(row) > 3 else 0
        total += val
        print(f"  {pe_name}: {dx_name} @ {ou_name} = {int(val)}")
    
    print(f"\nTOTAL for Meru County June 2025: {int(total)}")
else:
    print(f"Error response: {r.text[:500]}")
