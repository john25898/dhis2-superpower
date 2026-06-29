"""Test adding coc as a dimension to get disaggregated data."""
import requests
from requests.auth import HTTPBasicAuth
base = 'http://ereporting.chak.or.ke:8500/api/'
auth = HTTPBasicAuth('Johnbrian','JOHNb123\\')
ou = 'Y52XNJ50hYb'

# Method: add coc as a dimension
r = requests.get(
    f'{base}analytics.json?dimension=dx:kgzd9LfXZXq&dimension=pe:LAST_12_MONTHS&dimension=ou:{ou}&dimension=coc:&skipMeta=false',
    auth=auth, timeout=120
)
data = r.json()
headers = [h.get('name') for h in data.get('headers',[])]
print('Headers:', headers)
print('Rows:', len(data.get('rows',[])))
if data.get('rows'):
    for row in data['rows'][:8]:
        print(f'  {row}')
