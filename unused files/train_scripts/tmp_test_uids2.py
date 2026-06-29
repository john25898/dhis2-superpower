"""Extended test for CACX and GBV UIDs."""
import requests
from requests.auth import HTTPBasicAuth

auth = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
DHIS_BASE = 'http://ereporting.chak.or.ke:8500/api/'
meru_ou = 'Y52XNJ50hYb'

candidates = {
    # More CACX candidates
    'CACX_SCREEN_DONE': 'saKTnzr3iL0',  # already tested - 1167
    'CACX_POS': 'niWaZfcnBJ7',  # already tested - 0
    'CACX_TX_REF': 'mcenIAly5b2',  # already tested - 0
    'CACX_F_RESCREEN_POS': 'yFs4Vkok9Zx', 
    'CACX_RESCREEN_POS': 'qhArP8YFZdZ',
    'CACX_RESCREEN_VIA_POS': 'LeFDtr5BBBg',
    'CACX_SCR_POS': 'f3YK2yF5SWx',
    'CACX_SCR_POS_VIA': 'niWaZfcnBJ7',
    'CACX_EVER_SCR': 'f0UCLc3f5QU',
    'CACX_TX_CRYO': 'fGL2FbQI5zr',
    'CACX_TX_LEEP': 'v2K3Be8fYsf',
    'CACX_TX_THERMO': 'lprxSas7Hhw',
    'CACX_TX_HUGE': 'NIjT9MprURm',
    'CACX_POST_TX_POS': 'fSHFwpYo2Bu',
    'CACX_POST_TX_NEG': 'ylWEUoy0dSC',
    'BFW_CACX_F': 'HaXVdZItDmi',
    'BFW_CACX_PWD': 'R3CzCJ1r6k9',
    # More GBV candidates
    'GBV_CCC_SCR_F': 'HYYrlYulkFp',
    'GBV_CCC_SCR_M': 'VZo3pKVDr1e',
    'GBV_CCC_ID_F': 'y3oQtTDjFmy',
    'GBV_CCC_ID_M': 'o8BKK1oS2GE',
    'GBV_HTS_SCR_F': 'ONVGwp35Nu9',
    'GBV_HTS_SCR_M': 'U8TXCBAkRyo',
    'GBV_ANC_SCR_F': 'HYYrlYulkFp',
    'GBV_EV_ELIG': 'aH2hIYbu7Zl',
    'GBV_EV_TESTED': 'VqKlOiHr48Y',
    'GBV_EV_POS': 'jfFz99bXkrR',
    'GBV_EV_PVC': 'IppugXeTcB8',
}

print(f"{'Name':30s} {'UID':15s} {'Rows':>5s} {'Total':>10s}")
print('-' * 65)
for name, uid in candidates.items():
    url = f'{DHIS_BASE}analytics.json?dimension=dx:{uid}&dimension=pe:LAST_12_MONTHS&dimension=ou:{meru_ou}&displayProperty=NAME'
    try:
        resp = requests.get(url, auth=auth, timeout=60)
        data = resp.json()
        rows = data.get('rows', [])
        total = sum(float(r[-1]) for r in rows if r[-1]) if rows else 0
        print(f'{name:30s} {uid:15s} {len(rows):5d} {total:10.0f}')
    except Exception as e:
        print(f'{name:30s} {uid:15s} ERROR: {e}')
