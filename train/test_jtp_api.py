"""Test the new JTP endpoints."""
import requests, json

base = 'http://127.0.0.1:5000'

# Test ART Optimization
print("=" * 60)
print("TEST 1: ART Optimization")
print("=" * 60)
try:
    r = requests.get(f'{base}/api/hiv-treatment/dhis-live?type=art_optimization&county=Meru%20County&period=LAST_12_MONTHS', timeout=120)
    d = r.json()
    print(f'Status: {r.status_code}')
    print(f'Type: {d.get("type")}')
    if 'error' in d:
        print(f'ERROR: {d["error"]}')
    else:
        print(f'Title: {d.get("title")}')
        metrics = d.get('metrics', [])
        print(f'Metrics ({len(metrics)}):')
        for m in metrics:
            print(f'  {m["key"]}: {m["label"]}')
        trend = d.get('trend', [])
        print(f'Trend points: {len(trend)}')
        if trend:
            print(f'Latest: {json.dumps(trend[-1], indent=2)}')
except Exception as e:
    print(f'Exception: {e}')

print()
print("=" * 60)
print("TEST 2: DSD")
print("=" * 60)
try:
    r = requests.get(f'{base}/api/hiv-treatment/dhis-live?type=dsd&county=Meru%20County&period=LAST_12_MONTHS', timeout=120)
    d = r.json()
    print(f'Status: {r.status_code}')
    if 'error' in d:
        print(f'ERROR: {d["error"]}')
    else:
        print(f'Title: {d.get("title")}')
        trend = d.get('trend', [])
        print(f'Trend points: {len(trend)}')
        if trend:
            print(f'Latest: {json.dumps(trend[-1], indent=2)}')
except Exception as e:
    print(f'Exception: {e}')

print()
print("=" * 60)
print("TEST 3: Treatment Outcomes")
print("=" * 60)
try:
    r = requests.get(f'{base}/api/hiv-treatment/dhis-live?type=treatment_outcomes&county=Meru%20County&period=LAST_12_MONTHS', timeout=120)
    d = r.json()
    print(f'Status: {r.status_code}')
    if 'error' in d:
        print(f'ERROR: {d["error"]}')
    else:
        print(f'Title: {d.get("title")}')
        trend = d.get('trend', [])
        print(f'Trend points: {len(trend)}')
        if trend:
            print(f'Latest: {json.dumps(trend[-1], indent=2)}')
except Exception as e:
    print(f'Exception: {e}')
