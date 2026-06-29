"""Check CHAK API endpoints for issues."""
import requests
import json

BASE = 'http://127.0.0.1:5000/pbix/api'

# Check TB, Post Rape, CACX - the three with 0 periods
for page in ['tb', 'post-rape', 'cacx']:
    url = f'{BASE}/{page}?county=Meru County&period=LAST_12_MONTHS'
    print(f'\n=== {page.upper()} ===')
    try:
        r = requests.get(url, timeout=30)
        d = r.json()
        print(f'Status: {r.status_code}')
        print(f'Errors: {d.get("errors")}')
        print(f'Trend count: {len(d.get("trend",[]))}')
        print(f'Trend sample: {d.get("trend", [])[:2]}')
    except Exception as e:
        print(f'ERROR: {e}')

# Also check if the DX UIDs actually return data from DHIS2
print('\n\n=== Checking individual DHIS2 DX UIDs ===')
DHIS_BASE = 'http://ereporting.chak.or.ke:8500/api/'
from requests.auth import HTTPBasicAuth

auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')

uids_to_check = {
    'TB_STAT_DEN': 'xhGFBq5Sl70',
    'TB_STAT_NUM': 'n6bTQ8WxNBq',
    'TB_STAT_POS': 'LzCGg28dIjr',
    'TB_ART_NUM': 'DvW3IGMbvrS',
    'TB_ART_DEN': 'qU7ogfqKs3j',
    'HIV_TEST_TB': 'sF5DGBG6Mmk',
    'POST_RAPE_PE': 'QrHNYRDiASp',
    'POST_RAPE_SV': 'uKXnPfMV2mt',
    'POST_RAPE_TOTAL': 'd8jLfMwnD2D',
    'CXCA_SCRN': 'm4tBmhHv0xG',
    'CXCA_SCRN_POS': 'KSxXrwYCQHa',
    'CXCA_TX': 't5DoCQU42OQ',
}

# Meru OU ID
meru_ou = 'Y52XNJ50hYb'

for name, uid in uids_to_check.items():
    url = f'{DHIS_BASE}analytics.json?dimension=dx:{uid}&dimension=pe:LAST_12_MONTHS&dimension=ou:{meru_ou}&displayProperty=NAME'
    try:
        resp = requests.get(url, auth=auth, timeout=60)
        data = resp.json()
        rows = data.get('rows', [])
        total = sum(float(r[-1]) for r in rows if r[-1]) if rows else 0
        print(f'{name:20s} ({uid}): {len(rows)} rows, total={total:.0f}')
    except Exception as e:
        print(f'{name:20s} ({uid}): ERROR {e}')
