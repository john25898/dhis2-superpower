"""Quick script to check PBIX API data for all pages."""
import requests
import json

BASE = "http://127.0.0.1:5000/pbix/api"

pages = [
    "profile", "key-indicators", "prep", "hts-performance", "hts-index",
    "sns-cascade", "care-treatment", "cd4-tpt", "vl-cascade", "pmtct",
    "tb", "post-rape", "cacx", "iit-quarterly", "hts-summary",
    "testing-modality", "linkage"
]

for page in pages:
    try:
        r = requests.get(f"{BASE}/{page}?county=Meru%20County&period=LAST_12_MONTHS", timeout=30)
        data = r.json()
        trend = data.get("trend", [])
        errors = data.get("errors", [])
        print(f"\n{'='*50}")
        print(f"PAGE: {page} (status={r.status_code})")
        print(f"  trend rows: {len(trend)}")
        if errors:
            print(f"  ERRORS: {errors}")
        if trend:
            print(f"  sample keys: {list(trend[0].keys())}")
            print(f"  sample row: {trend[0]}")
        else:
            print(f"  ⚠️  NO TREND DATA - EMPTY!")
    except Exception as e:
        print(f"\nPAGE: {page} - ERROR: {e}")
