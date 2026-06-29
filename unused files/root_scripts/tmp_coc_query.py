import requests, json
from requests.auth import HTTPBasicAuth

AUTH = HTTPBasicAuth('Johnbrian', 'JOHNb123\\')
BASE = 'http://ereporting.chak.or.ke:8500/api'

# Get all category option combos for "Finer Age Bands and Gender"
url = f'{BASE}/categoryOptionCombos.json'
params = {
    'fields': 'id,name',
    'paging': 'false',
    'filter': 'categoryCombo.name:eq:Finer Age Bands and Gender',
}
r = requests.get(url, params=params, auth=AUTH, timeout=60)
combos = r.json().get('categoryOptionCombos', [])
print(f"=== Category Option Combos for 'Finer Age Bands and Gender' ({len(combos)} found) ===")
coc_map = {}
for co in combos:
    name = co['name']
    print(f"  {co['id']} -> {name}")
    coc_map[name] = co['id']

# Our target age bands
age_bands = ["<1","1-4","5-9","10-14","15-19","20-24",
             "25-29","30-34","35-39","40-44","45-49",
             "50-54","55-59","60-64","65+"]

# Map to COC names: "<1 year, Female", "<1 year, Male", etc.
# Note DHIS2 uses "<1 year" not "<1"
age_to_dhis = {
    "<1": "<1 year",
    "1-4": "1-4 years",
    "5-9": "5-9 years", 
    "10-14": "10-14 years",
    "15-19": "15-19 years",
    "20-24": "20-24 years",
    "25-29": "25-29 years",
    "30-34": "30-34 years",
    "35-39": "35-39 years",
    "40-44": "40-44 years",
    "45-49": "45-49 years",
    "50-54": "50-54 years",
    "55-59": "55-59 years",
    "60-64": "60-64 years",
    "65+": "65+ years",
}

male_cocs = []
female_cocs = []
for age in age_bands:
    dhis_age = age_to_dhis[age]
    male_name = f"{dhis_age}, Male"
    female_name = f"{dhis_age}, Female"
    m_id = coc_map.get(male_name, "NOT_FOUND")
    f_id = coc_map.get(female_name, "NOT_FOUND")
    print(f"\n{age}: M={m_id}, F={f_id}")
    if m_id != "NOT_FOUND":
        male_cocs.append(m_id)
    if f_id != "NOT_FOUND":
        female_cocs.append(f_id)

print(f"\nFound {len(male_cocs)} male COCs, {len(female_cocs)} female COCs")

# Now query TX_CURR with all COCs
print("\n\n=== TX_CURR analytics with COC disaggregation ===")
all_cocs = male_cocs + female_cocs
coc_str = ";".join(all_cocs)

analytics_url = f'{BASE}/analytics.json'
params = {
    'dimension': [f'dx:kgzd9LfXZXq', f'co:{coc_str}', 'pe:LAST_12_MONTHS', 'ou:Y52XNJ50hYb'],
    'displayProperty': 'NAME',
}
r = requests.get(analytics_url, params=params, auth=AUTH, timeout=120)
data = r.json()
print(f"Rows: {len(data.get('rows', []))}")
# Show first 5 rows
for row in data.get('rows', [])[:5]:
    print(f"  {row}")
