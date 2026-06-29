import os
import pandas as pd
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

load_dotenv()
base = os.getenv("DHIS_BASE_URL")
user = os.getenv("DHIS_USERNAME")
pwd = os.getenv("DHIS_PASSWORD")

terms = ["jamii", "tekelezi", "chap", "stawisha"]

url = base + "organisationUnits.json?fields=id,name,level,path,parent[id,name]&paging=false"
resp = requests.get(url, auth=HTTPBasicAuth(user, pwd), timeout=120)
resp.raise_for_status()
org_units = resp.json().get("organisationUnits", [])

hits = [u for u in org_units if any(t in str(u.get("name", "")).lower() for t in terms)]
print("LIVE_DHIS_HITS", len(hits))
for h in hits[:500]:
    print(f"{h.get('id')} | L{h.get('level')} | {h.get('name')}")

print("\nLOCAL_DICTIONARY_CHECK")
df = pd.read_csv("dictionaries/master_facilities.csv", dtype=str)
for t in terms:
    m = df[df["name"].str.contains(t, case=False, na=False)]
    print(f"TERM={t} COUNT={len(m)}")
    for _, row in m.head(20).iterrows():
        print(f"  {row.get('id')} | L{row.get('level')} | {row.get('name')}")
