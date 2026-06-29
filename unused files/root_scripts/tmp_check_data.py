import sys, os
os.chdir(r"c:\Users\ADMIN\Documents\dhis2_superpower\train")
sys.path.insert(0, ".")
from app import create_app
app = create_app()
with app.test_client() as c:
    d = c.get("/api/hiv-treatment/dhis-live?type=tx_new&county=Meru+County&period=LAST_12_MONTHS").get_json()
    print("=== TX_NEW ===")
    print("metrics:", d.get("metrics"))
    print("age_bands:", d.get("age_bands"))
    print("trend:")
    for p in (d.get("trend") or []):
        print(f"  {p['label']}: total={p.get('total')}, males={p.get('males')}, females={p.get('females')}")
    print("monthly_cards count:", len(d.get("monthly_cards") or []))
    for mc in (d.get("monthly_cards") or [])[:3]:
        print(f"  {mc['label']}: total={mc.get('total')}, males={mc.get('males')}, females={mc.get('females')}")
    
    d2 = c.get("/api/hiv-treatment/dhis-live?type=tx_curr&county=Meru+County&period=LAST_12_MONTHS").get_json()
    print("\n=== TX_CURR ===")
    print("metrics:", d2.get("metrics"))
    print("trend:")
    for p in (d2.get("trend") or []):
        print(f"  {p['label']}: total={p.get('total')}, males={p.get('males')}, females={p.get('females')}")
