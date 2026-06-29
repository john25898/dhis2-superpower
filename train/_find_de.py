import csv
rows = []
with open(r'c:\Users\ADMIN\Documents\dhis2_superpower\dictionaries\master_data_elements.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        name = row.get('name', '')
        if 'tx_curr' in name.lower() or 'tx_cur' in name.lower() or 'tx_new' in name.lower():
            rows.append(row)

for r in rows[:40]:
    print(f"{r.get('id','')} | {r.get('name','')}")
print(f'--- Total matches: {len(rows)} ---')
