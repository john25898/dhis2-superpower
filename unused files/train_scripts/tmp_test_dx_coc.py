"""Test DX.COC notation for filtering by category option combo."""
import requests
from requests.auth import HTTPBasicAuth
base = 'http://ereporting.chak.or.ke:8500/api/'
auth = HTTPBasicAuth('Johnbrian','JOHNb123\\')
ou = 'Y52XNJ50hYb'

# Test: filter TX_CURR by "30-34 years, Female" COC = sk5UiD3PrxH
# In DHIS2, you can use dx:UID.COC format
r = requests.get(
    f'{base}analytics.json?dimension=dx:kgzd9LfXZXq.sk5UiD3PrxH&dimension=pe:LAST_12_MONTHS&dimension=ou:{ou}',
    auth=auth, timeout=120
)
data = r.json()
headers = [h.get('name') for h in data.get('headers',[])]
print('Headers:', headers)
print('Rows:', len(data.get('rows',[])))
total = sum(float(row[-1]) for row in data.get('rows',[]) if row[-1])
print(f'Total (30-34 Female): {total:.0f}')

# Test: Another COC - "30-34 years, Male" = b91xfEPrY4D
r2 = requests.get(
    f'{base}analytics.json?dimension=dx:kgzd9LfXZXq.b91xfEPrY4D&dimension=pe:LAST_12_MONTHS&dimension=ou:{ou}',
    auth=auth, timeout=120
)
data2 = r2.json()
total2 = sum(float(row[-1]) for row in data2.get('rows',[]) if row[-1])
print(f'Total (30-34 Male): {total2:.0f}')
