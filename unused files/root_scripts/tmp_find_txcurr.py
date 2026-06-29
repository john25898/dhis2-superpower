import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Test TX_CURR candidates
candidates = {
    'TOTAL TX_Curr': 'Ft6BnYNtmIj',
    'TX_CURR': 'kgzd9LfXZXq',
    'TX_CURR Patients on Care': 'aMp82zBYPnx',
    'TX_CURR : Targets': 'rWv24UDMupA',
    '25+yrs TX_Curr': 'Rdp6ejH0HY1',
    '<15yrs TX_Curr': 'ZVtoWT9fM9X',
    '15-24yrs TX_Curr': 'nAbyf6mu89W',
    'TX_CURR (MCH)': 'BbGireMNmGG',
    'C&T (facility) - TX_CURR': 'ULVYtRIxS5m',
    'C&T (KeyPop) - TX_CURR': 'UEoERQIrJf0',
}

analytics_url = f'{BASE}/analytics.json'
for label, dx_id in candidates.items():
    params = {
        'dimension': [f'dx:{dx_id}', 'pe:LAST_12_MONTHS', 'ou:Y52XNJ50hYb'],
        'displayProperty': 'NAME',
    }
    r = requests.get(analytics_url, params=params, auth=AUTH, timeout=60)
    data = r.json()
    rows = data.get('rows', [])
    total = sum(float(r[-1]) for r in rows if r[-1])
    print(f"{label} ({dx_id}): {len(rows)} months, total sum={total:.0f}")
    if rows and len(rows) > 0:
        # Show the last 2 months
        for r in rows[-2:]:
            print(f"  {r[1]}: {r[-1]}")
