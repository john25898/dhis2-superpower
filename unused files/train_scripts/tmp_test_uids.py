"""Test candidate UIDs for TB, CACX, Post Rape against DHIS2."""
import requests
from requests.auth import HTTPBasicAuth

auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
DHIS_BASE = 'http://ereporting.chak.or.ke:8500/api/'
meru_ou = 'Y52XNJ50hYb'

# Candidate UIDs to test
candidates = {
    # TB
    'TB_STAT_DEN': 'QKXjusWFsgw',
    'TB_STAT_NUM': 'fNpw5xn9xMG',
    'TB_KNOWN_POS': 'HU6UkbewNJi',
    'TB_NEW_POS': 'fFS44bY07SY',
    'TB_KNOWN_NEG': 'QMtvRbG9oDA',
    'TB_NEW_NEG': 'jTOkHMNFtrU',
    'TB_STAT_KNOWN_POS': 'TNjfvn2OLAs',
    'TB_STAT_RECENT_NEG': 'ILx5Fy2Pkxj',
    'TB_ART_ALREADY': 'LS1yYCAuHyA',
    'TB_ART_NEW': 'rWoEL18JGDx',
    'TB_ART_DEN_ALREADY': 'lxuNw0ndTmS',
    'TB_ART_DEN_NEW': 't4mFpja7Ntj',
    'TB_ART_NUM_ALREADY': 'Q3BDMIGFNPT',
    'TB_ART_NUM_NEW': 'P8E51Nn9WBf',
    # CACX
    'CACX_SCREENED': 'srxje97qXoI',
    'CACX_POS': 'U4GNBXz3wPg',
    'CACX_TX': 'mcenIAly5b2',
    'CACX_SCREEN_DONE': 'saKTnzr3iL0',
    'CACX_POS2': 'niWaZfcnBJ7',
    # GBV / Post Rape
    'GBV_EV_ELIGIBLE': 'aH2hIYbu7Zl',
    'GBV_EV_TESTED': 'VqKlOiHr48Y',
    'GBV_EV_POS': 'jfFz99bXkrR',
    'GBV_EV_PVC': 'IppugXeTcB8',
}

print(f"{'Name':25s} {'UID':15s} {'Rows':>5s} {'Total':>10s}")
print('-' * 60)
for name, uid in candidates.items():
    url = f'{DHIS_BASE}analytics.json?dimension=dx:{uid}&dimension=pe:LAST_12_MONTHS&dimension=ou:{meru_ou}&displayProperty=NAME'
    try:
        resp = requests.get(url, auth=auth, timeout=60)
        data = resp.json()
        rows = data.get('rows', [])
        total = sum(float(r[-1]) for r in rows if r[-1]) if rows else 0
        print(f'{name:25s} {uid:15s} {len(rows):5d} {total:10.0f}')
    except Exception as e:
        print(f'{name:25s} {uid:15s} ERROR: {e}')
