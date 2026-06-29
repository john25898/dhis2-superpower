import csv

with open('dictionaries/master_data_elements.csv', 'r', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

terms = ['sns','hrn','iit total','iit_duration','directly assisted','unassisted','elicitation',
         'facilities offering','cascade total','cascade_percent','test kits','pmtct_stat',
         'pns_cascade','tb_cascade','index modality','tb cascade','total tb']
seen = set()
for r in rows:
    n = r.get('name', '').lower()
    rid = r.get('id', '')
    if any(t in n for t in terms):
        key = (rid, r['name'])
        if key not in seen:
            seen.add(key)
            print(f"{rid} | {r['name']}")
