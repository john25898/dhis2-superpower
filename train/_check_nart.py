import requests, json
r = requests.get('http://127.0.0.1:5000/api/hiv-treatment/nart-trend?county=Meru%20County&period=LAST_12_MONTHS')
d = r.json()
print(json.dumps({k: d.get(k) for k in ['ok','metrics','county','fetched_at','type']}, indent=2))
if d.get('trend'):
    print(f'Trend points: {len(d["trend"])}')
    print(json.dumps(d['trend'][:3], indent=2))
if d.get('error'):
    print('ERROR:', d['error'])
