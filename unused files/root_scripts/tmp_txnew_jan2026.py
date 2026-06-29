import os
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

load_dotenv()
base = os.getenv("DHIS_BASE_URL")
s = requests.Session()
s.auth = HTTPBasicAuth(os.getenv("DHIS_USERNAME"), os.getenv("DHIS_PASSWORD"))

# TX_NEW: Starting ART for Meru County in January 2026
dx = "vTTEybkXZ53"  # TX_NEW: Starting ART
ou = "Y52XNJ50hYb"  # Meru County
pe = "202601"        # January 2026

url = f"{base}analytics.json?dimension=dx:{dx}&dimension=ou:{ou}&dimension=pe:{pe}"
print("URL:", url)

r = s.get(url, timeout=45)
print("Status:", r.status_code)

if r.status_code == 200:
    data = r.json()
    headers = [h.get("name") for h in data.get("headers", [])]
    rows = data.get("rows", [])
    meta = data.get("metaData", {}).get("items", {})

    total = 0
    for row in rows:
        pe_name = meta.get(row[2], {}).get("name", row[2]) if len(row) > 2 else ""
        dx_name = meta.get(row[0], {}).get("name", row[0]) if len(row) > 0 else ""
        val = float(row[3]) if len(row) > 3 else 0
        total += val
        print(" {}: {} @ Meru County = {}".format(pe_name, dx_name, int(val)))

    print("\nTOTAL TX_NEW in Meru County for January 2026: {}".format(int(total)))
else:
    print("Error: {} - {}".format(r.status_code, r.text[:500]))
