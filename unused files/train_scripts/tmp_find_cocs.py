"""Find sex and age category option combos in DHIS2."""
import requests
from requests.auth import HTTPBasicAuth
base = 'http://ereporting.chak.or.ke:8500/api/'
auth = HTTPBasicAuth('Johnbrian','JOHNb123\\')

r = requests.get(f'{base}categoryCombos.json?fields=id,name,categoryOptionCombos[id,name]&paging=false', auth=auth, timeout=30)
data = r.json()
for cc in data.get('categoryCombos', []):
    name = cc.get('name','')
    if any(k in name.upper() for k in ['SEX','GENDER','AGE','DEFAULT']):
        print(f'Combo: {name} ({cc["id"]})')
        for coc in cc.get('categoryOptionCombos', []):
            print(f'  COC: {coc["name"]} = {coc["id"]}')
        print()
