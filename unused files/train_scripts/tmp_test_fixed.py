"""Test fixed endpoints - TB, Post Rape, CACX."""
import requests
import json

base = "http://127.0.0.1:5000/pbix/api"

for name, endpoint in [
    ("TB", "/tb?county=Meru&period=LAST_12_MONTHS"),
    ("POST RAPE", "/post-rape?county=Meru&period=LAST_12_MONTHS"),
    ("CACX", "/cacx?county=Meru&period=LAST_12_MONTHS"),
]:
    try:
        r = requests.get(f"{base}{endpoint}", timeout=60)
        data = r.json()
        trend = data.get("trend", [])
        print(f"\n=== {name} === (status={r.status_code}, periods={len(trend)})")
        print(f"  errors: {data.get('errors')}")
        if trend:
            # Show first period
            t = trend[0]
            print(f"  First period ({t['period']}): {json.dumps(t, indent=4)}")
            # Show last period
            t = trend[-1]
            print(f"  Last period ({t['period']}): {json.dumps(t, indent=4)}")
            # Show total
            sums = {}
            for k in trend[0]:
                if k not in ("period", "label"):
                    sums[k] = sum(float(t.get(k, 0)) for t in trend)
            print(f"  Totals: {json.dumps(sums, indent=4)}")
    except Exception as e:
        print(f"\n=== {name} === ERROR: {e}")
