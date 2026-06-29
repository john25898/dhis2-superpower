"""Check what fields each CHAK endpoint returns so we know what data is available for charting."""
import sys; sys.path.insert(0, r'c:\Users\ADMIN\Documents\dhis2_superpower\train')
import requests

endpoints = [
    ("hts-performance", "HTS Performance"),
    ("hts-index", "HTS Index"),
    ("sns-cascade", "SNS Cascade"),
    ("care-treatment", "Care & Treatment"),
    ("cd4-tpt", "CD4/TPT"),
    ("vl-cascade", "VL Cascade"),
    ("key-indicators", "Key Indicators"),
]

for ep, name in endpoints:
    r = requests.get(f'http://127.0.0.1:5003/pbix/api/{ep}?county=Meru&period=LAST_12_MONTHS', timeout=15)
    d = r.json()
    trend = d.get('trend', [])
    if trend:
        fields = list(trend[0].keys())
        print(f'{name:20s}: {", ".join(fields)}')
    else:
        print(f'{name:20s}: NO TREND')
