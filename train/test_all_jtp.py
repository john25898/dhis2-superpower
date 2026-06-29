import requests, json

endpoints = [
    ('art_optimization', '/api/hiv-treatment/dhis-live?type=art_optimization'),
    ('dsd', '/api/hiv-treatment/dhis-live?type=dsd'),
    ('treatment_outcomes', '/api/hiv-treatment/dhis-live?type=treatment_outcomes'),
    ('otz', '/api/hiv-treatment/dhis-live?type=otz'),
    ('ovc', '/api/hiv-treatment/dhis-live?type=ovc'),
    ('covid', '/api/hiv-treatment/dhis-live?type=covid'),
    ('ahd', '/api/hiv-treatment/dhis-live?type=ahd'),
    ('adverse_events', '/api/hiv-treatment/dhis-live?type=adverse_events'),
]
for name, url in endpoints:
    try:
        r = requests.get(f'http://127.0.0.1:5000{url}', timeout=30)
        data = r.json()
        metrics = len(data.get('metric_list', []))
        trends = len(data.get('trend', []))
        latest_keys = list(data['trend'][-1].keys())[:5] if trends > 0 else []
        print(f'{name:20s} | Status:{r.status_code} | Metrics:{metrics:2d} | Trends:{trends:2d} | Latest keys: {latest_keys}')
    except Exception as e:
        print(f'{name:20s} | ERROR: {e}')
