import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Check TX_NEW category combo
url = f'{BASE}/dataElements/vTTEybkXZ53.json'
params = {'fields': 'id,name,categoryCombo[id,name]'}
r = requests.get(url, params=params, auth=AUTH, timeout=30)
de = r.json()
print(f"TX_NEW: {de.get('name')}")
print(f"Category Combo: {de.get('categoryCombo',{}).get('name')}")

# Query TX_NEW with COCs
male_cocs = ["AwerOu6rx5q","g2zP3yNwOOa","WTfu1bBSG12","X65JamO5tyb","hKHprPKwjL6",
             "uSDHHGh2DZo","sLaLEIDVusT","b91xfEPrY4D","EU7hVFz5Yyt","AR2E4Yiuo8Z",
             "dfkyp7ZQZSr","lswMoqT008e","Z6zV5L8i14I","XIc55yRW4aQ","g5bVF4b8hmV"]
female_cocs = ["dcv8Lowu94w","D2aMSzo7SEw","HIS0TcFAoo8","Rr3uh3eAvKi","DYDpnZWu1XK",
               "m7Y0ddB212k","qy1vJGvFJeB","sk5UiD3PrxH","Vb7KzTvF83C","dchngmvBGvb",
               "VP1zCgdzuBb","uefSjW3VtZr","llt7APqVWyq","gs3y2muDLIK","YAtW6LDL24J"]

all_cocs = male_cocs + female_cocs
coc_str = ";".join(all_cocs)

analytics_url = f'{BASE}/analytics.json'

# Query TX_NEW with COCs
params = {
    'dimension': [f'dx:vTTEybkXZ53', f'co:{coc_str}', 'pe:LAST_12_MONTHS', 'ou:Y52XNJ50hYb'],
    'displayProperty': 'NAME',
}
r = requests.get(analytics_url, params=params, auth=AUTH, timeout=120)
data = r.json()
rows = data.get('rows', [])
print(f"\nTX_NEW rows: {len(rows)}")

# Aggregate by period, sex, and age band
from collections import defaultdict
by_period_sex = defaultdict(lambda: {"males": 0.0, "females": 0.0})
by_period_age_m = defaultdict(lambda: defaultdict(float))
by_period_age_f = defaultdict(lambda: defaultdict(float))

age_bands = ["<1","1-4","5-9","10-14","15-19","20-24",
             "25-29","30-34","35-39","40-44","45-49",
             "50-54","55-59","60-64","65+"]

male_coc_set = set(male_cocs)
female_coc_set = set(female_cocs)
coc_to_age_m = {c: a for c, a in zip(male_cocs, age_bands)}
coc_to_age_f = {c: a for c, a in zip(female_cocs, age_bands)}

meta = data.get('metaData', {}).get('items', {})
for row in rows:
    dx, coc, pe, ou, val = row[0], row[1], row[2], row[3], float(row[4]) if len(row) > 4 else 0
    pe_name = meta.get(pe, {}).get('name', pe)
    if coc in male_coc_set:
        by_period_sex[pe_name]["males"] += val
        by_period_age_m[pe_name][coc_to_age_m[coc]] += val
    elif coc in female_coc_set:
        by_period_sex[pe_name]["females"] += val
        by_period_age_f[pe_name][coc_to_age_f[coc]] += val

# Show last period
periods = sorted(by_period_sex.keys())
last = periods[-1]
print(f"\n=== TX_NEW {last} ===")
print(f"  Males total: {by_period_sex[last]['males']:.0f}")
print(f"  Females total: {by_period_sex[last]['females']:.0f}")
print(f"  Grand total: {by_period_sex[last]['males'] + by_period_sex[last]['females']:.0f}")
print("  Male age bands:")
for a in age_bands:
    print(f"    {a:>6s}: {by_period_age_m[last].get(a, 0):.0f}")
print("  Female age bands:")
for a in age_bands:
    print(f"    {a:>6s}: {by_period_age_f[last].get(a, 0):.0f}")
