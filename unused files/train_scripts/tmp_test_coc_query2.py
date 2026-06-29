import requests
from requests.auth import HTTPBasicAuth
base = 'http://ereporting.chak.or.ke:8500/api/'
auth = HTTPBasicAuth('Johnbrian','JOHNb123\\')
ou = 'Y52XNJ50hYb'  # Meru

# Try with explicit coc dimension
r = requests.get(
    f'{base}analytics.json?dimension=dx:kgzd9LfXZXq&dimension=coc:&dimension=pe:LAST_12_MONTHS&dimension=ou:{ou}',
    auth=auth, timeout=120
)
data = r.json()
print('Headers:', [h.get('name') for h in data.get('headers',[])])
print('Rows:', len(data.get('rows',[])))
if data.get('rows'):
    # Show first 5 and last 5 rows
    for row in data['rows'][:5]:
        print(f'  {row}')
    if len(data['rows']) > 10:
        print('  ...')
        for row in data['rows'][-5:]:
            print(f'  {row}')
