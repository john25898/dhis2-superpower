import requests
from requests.auth import HTTPBasicAuth
base = 'http://ereporting.chak.or.ke:8500/api/'
auth = HTTPBasicAuth('Johnbrian','JOHNb123\\')
ou = 'Y52XNJ50hYb'  # Meru

# Test: query TX_CURR with analytics - check if COC column is in the result
r = requests.get(
    f'{base}analytics.json?dimension=dx:kgzd9LfXZXq&dimension=pe:LAST_12_MONTHS&dimension=ou:{ou}',
    auth=auth, timeout=120
)
data = r.json()
print('Headers:', [h.get('name') for h in data.get('headers',[])])
print('Total rows:', len(data.get('rows',[])))

# Sum by gender from COC name
male_total = 0
female_total = 0
for row in data.get('rows',[]):
    # row = [dx, coc, pe, ou, value] or [dx, pe, ou, value]
    val = float(row[-1]) if row[-1] else 0
    print(f'  Row: {row}')
print(f'Male total: {male_total}, Female total: {female_total}')
