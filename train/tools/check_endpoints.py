import sys
from pathlib import Path
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))
from app import create_app
app = create_app()
client = app.test_client()

res = client.get('/api/dashboard-data')
print('dashboard-data', res.status_code)
if res.status_code == 200:
    payload = res.get_json()
    print('row_count:', payload.get('row_count'))
    print('columns_count:', len(payload.get('columns', [])))
else:
    print(res.data)

res = client.get('/api/charts')
print('\n/charts', res.status_code)
if res.status_code == 200:
    charts = res.get_json().get('charts', [])
    print('charts_count:', len(charts))
    if charts:
        print('first:', charts[0].get('id'), '-', charts[0].get('title'))
else:
    print(res.data)

res = client.get('/api/dashboard-overview')
print('\n/overview', res.status_code)
if res.status_code == 200:
    ov = res.get_json()
    metrics = ov.get('metrics', {})
    print('overview.metrics sample:', {k: metrics.get(k) for k in ['row_count','facility_count','total_visits']})
else:
    print(res.data)

res = client.get('/api/catalog')
print('\n/catalog', res.status_code)
if res.status_code == 200:
    cat = res.get_json()
    print('catalog.columns sample:', cat.get('columns')[:8])
else:
    print(res.data)
