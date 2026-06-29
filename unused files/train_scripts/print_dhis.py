"""Print facility-level DHIS2 Tx_New data with NAMES for each county."""
import os, requests
from requests.auth import HTTPBasicAuth

dhis_base = os.getenv('DHIS_BASE_URL', 'http://ereporting.chak.or.ke:8500/api/')
username = os.getenv('DHIS_USERNAME', 'Johnbrian')
password = os.getenv('DHIS_PASSWORD', 'JOHNb123\\')
auth = HTTPBasicAuth(username, password)

COUNTIES = [
    ("Y52XNJ50hYb", "Meru County"),
    ("PFu8alU2KWG", "Embu County"),
    ("mYZacFNIB3h", "Nyandarua County"),
    ("T4urHM47nlm", "Tharaka Nithi County"),
]

DX_TOTAL = "gv7bbGesTTJ"
url = dhis_base.rstrip('/') + '/analytics.json'

for ou_id, county_name in COUNTIES:
    print(f"\n{'='*90}")
    print(f"  {county_name} - Tx_New STA (gv7bbGesTTJ) - Facility Detail - LAST_12_MONTHS")
    print(f"{'='*90}")

    params = {
        'dimension': [f'dx:{DX_TOTAL}', 'pe:LAST_12_MONTHS', f'ou:LEVEL-5;{ou_id}'],
        'displayProperty': 'NAME',
        'includeDescendants': 'true',
    }
    try:
        resp = requests.get(url, params=params, auth=auth, timeout=120)
        if not resp.ok:
            print(f"  HTTP {resp.status_code}")
            continue

        data = resp.json()
        headers = [h.get('name', '') for h in data.get('headers', [])]
        rows = data.get('rows', [])
        meta = data.get('metaData', {})
        items = meta.get('items', {})
        dimensions = meta.get('dimensions', {})

        # Build OU ID -> name from metadata items
        ou_names = {}
        for uid, info in items.items():
            name = info.get('name', '')
            if name:
                ou_names[uid] = name

        # Also from ou dimension
        ou_dim = dimensions.get('ou', [])
        for uid in ou_dim:
            if uid not in ou_names:
                info = items.get(uid, {})
                name = info.get('name', uid)
                ou_names[uid] = name

        hdr_lower = [h.lower() for h in headers]
        pe_idx = next((i for i,h in enumerate(hdr_lower) if h in ('pe','period')), 0)
        ou_idx = next((i for i,h in enumerate(hdr_lower) if h in ('ou','organisation unit')), 1)
        val_idx = next((i for i,h in enumerate(hdr_lower) if h == 'value'), len(headers)-1)

        print(f"  Rows: {len(rows)}")
        print(f"  {'Period':<10} {'Facility':<50} {'Value':>8}")
        print(f"  {'-'*70}")

        for row in sorted(rows, key=lambda r: (str(r[pe_idx]), str(r[ou_idx]))):
            period = str(row[pe_idx])
            ou_raw = str(row[ou_idx])
            facility = ou_names.get(ou_raw, ou_raw)
            value = row[val_idx]
            print(f"  {period:<10} {facility[:48]:<50} {str(value):>8}")

        # Period totals
        print(f"\n  --- {county_name} MONTHLY TOTALS ---")
        totals = {}
        for row in rows:
            p = str(row[pe_idx])
            v = float(row[val_idx]) if row[val_idx] else 0
            totals[p] = totals.get(p, 0) + v
        for p in sorted(totals.keys()):
            print(f"  {p:<10} {'[COUNTY TOTAL]':<50} {totals[p]:8.1f}")

    except Exception as e:
        import traceback
        print(f"  EXCEPTION: {e}")
        traceback.print_exc()

print(f"\n{'='*90}")
print("  DONE - Cross-check with DHIS2 UI")
print(f"{'='*90}")
