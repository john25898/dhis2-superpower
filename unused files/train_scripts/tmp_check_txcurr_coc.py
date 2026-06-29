import requests
from requests.auth import HTTPBasicAuth
base = 'http://ereporting.chak.or.ke:8500/api/'
auth = HTTPBasicAuth('Johnbrian','JOHNb123\\')

# Check what category combo TX_CURR uses
r = requests.get(f'{base}dataElements/kgzd9LfXZXq.json?fields=id,name,categoryCombo[id,name,categoryOptionCombos[id,name]]', auth=auth, timeout=30)
d = r.json()
print('DE:', d.get('name'))
cc = d.get('categoryCombo',{})
print('CatCombo:', cc.get('name'), cc.get('id'))
for coc in cc.get('categoryOptionCombos',[]):
    cname = coc.get('name','')
    cid = coc.get('id','')
    print(f'  COC: {cname} = {cid}')
