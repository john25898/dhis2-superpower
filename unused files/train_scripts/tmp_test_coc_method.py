"""Test querying DHIS2 analytics with COC dimension to get sex breakdown."""
import requests
from requests.auth import HTTPBasicAuth
base = 'http://ereporting.chak.or.ke:8500/api/'
auth = HTTPBasicAuth('Johnbrian','JOHNb123\\')
ou = 'Y52XNJ50hYb'

# Method 1: Add coc as column dimension (returns headers including 'coc')
r = requests.get(
    f'{base}analytics.json?dimension=dx:kgzd9LfXZXq&dimension=pe:LAST_12_MONTHS&dimension=ou:{ou}&columns=dx;coc&rows=pe;ou&skipMeta=true',
    auth=auth, timeout=120
)
data = r.json()
headers = [h.get('name') for h in data.get('headers',[])]
print('Headers:', headers)
print('Rows:', len(data.get('rows',[])))
if data.get('rows'):
    for row in data['rows'][:5]:
        print(f'  {row}')
    print('  ...')
