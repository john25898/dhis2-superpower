"""Test Tx_New STA indicator directly on CHAK server."""
import requests
from requests.auth import HTTPBasicAuth
import json

base = 'http://ereporting.chak.or.ke:8500/api'
auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')

# Test Tx_New STA for Meru District Hospital
url = f'{base}/analytics.json?dimension=dx:gv7bbGesTTJ&dimension=ou:uwvOG2N2Cmt&dimension=pe:LAST_6_MONTHS'
print(f"URL: {url}")
r = requests.get(url, auth=auth, timeout=60)
if r.ok:
    data = r.json()
    headers = data.get('headers', [])
    rows = data.get('rows', [])
    print(f"Status: {r.status_code}, Rows: {len(rows)}")
    if rows:
        print(f"Headers: {[h['name'] for h in headers]}")
        for row in rows[:5]:
            print(f"  {row}")
    print(f"Total from meta: {data.get('metaData', {}).get('totals', {})}")
else:
    print(f"Error: {r.status_code}")
    print(r.text[:500])

# Also test at Meru County level
print("\n--- Meru County ---")
url2 = f'{base}/analytics.json?dimension=dx:gv7bbGesTTJ&dimension=ou:Y52XNJ50hYb&dimension=pe:LAST_6_MONTHS'
r2 = requests.get(url2, auth=auth, timeout=60)
if r2.ok:
    data2 = r2.json()
    rows2 = data2.get('rows', [])
    print(f"Rows: {len(rows2)}")
    for row in rows2[:5]:
        print(f"  {row}")
else:
    print(f"Error: {r2.status_code}")
