import sys, os
os.chdir(r"c:\Users\ADMIN\Documents\dhis2_superpower\train")
sys.path.insert(0, ".")
from app import create_app
app = create_app()
with app.test_client() as c:
    d = c.get("/api/hiv-treatment/dhis-live?type=tx_new&county=Meru+County&period=LAST_12_MONTHS").get_json()
    
    # Check April 2026 monthly card for individual age bands
    for mc in (d.get("monthly_cards") or []):
        if mc["label"] == "2026-04":
            print("=== April 2026 TX_NEW Meru ===")
            print(f"Total (aggregate): {mc['total']}")
            print(f"Males (summed): {mc['males']}")
            print(f"Females (summed): {mc['females']}")
            print(f"Males+Females = {mc['males'] + mc['females']}")
            print()
            print("Male age bands:")
            male_sum = 0
            for mb in mc.get("male_bands", []):
                male_sum += mb["value"]
                print(f"  {mb['age']:>6s}: {mb['value']}")
            print(f"  Male band sum: {male_sum}")
            print()
            print("Female age bands:")
            female_sum = 0
            for fb in mc.get("female_bands", []):
                female_sum += fb["value"]
                print(f"  {fb['age']:>6s}: {fb['value']}")
            print(f"  Female band sum: {female_sum}")
            print()
            print(f"Total from summing bands: {male_sum + female_sum}")
            print(f"Total from aggregate: {mc['total']}")
            if male_sum + female_sum != mc['total']:
                print("⚠️ MISMATCH - aggregate differs from sum of bands!")
            break
