import urllib.request, json, sys
u = 'http://127.0.0.1:5000/api/hiv-treatment/dhis-live?type=tx_new&county=Meru+County&period=LAST_12_MONTHS'
try:
    r = urllib.request.urlopen(u, timeout=120)
    d = json.loads(r.read())
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
cards = d.get('monthly_cards', [])
print(f"Got {len(cards)} months of data")
# Find April 2026
for mc in cards:
    if mc['label'] == '2026-04':
        print('=== April 2026 TX_NEW Meru ===')
        print(f"Total (aggregate): {mc['total']}")
        print(f"Males (summed): {mc['males']}")
        print(f"Females (summed): {mc['females']}")
        male_sum = sum(b['value'] for b in mc.get('male_bands',[]))
        female_sum = sum(b['value'] for b in mc.get('female_bands',[]))
        print(f"Males+Fem (from summed): {mc['males'] + mc['females']}")
        print(f"Sum male bands: {male_sum}")
        print(f"Sum female bands: {female_sum}")
        print(f"Total from bands: {male_sum + female_sum}")
        print("Male age bands:")
        for b in mc.get('male_bands',[]):
            print(f"  {b['age']:>6s}: {b['value']}")
        print("Female age bands:")
        for b in mc.get('female_bands',[]):
            print(f"  {b['age']:>6s}: {b['value']}")
        break
