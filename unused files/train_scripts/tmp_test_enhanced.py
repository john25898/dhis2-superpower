"""Quick test for enhanced endpoints."""
import sys, json
sys.path.insert(0, '.')
import importlib
import app
importlib.reload(app)
from app import create_app
application = create_app()
with application.test_client() as c:
    for ep in ['hts-performance', 'hts-summary', 'testing-modality', 'sns-cascade']:
        r = c.get(f'/pbix/api/{ep}?county=Meru County&period=LAST_12_MONTHS')
        data = json.loads(r.data)
        trend = data.get('trend', [])
        fields = list(trend[0].keys()) if trend else []
        print(f'{ep}: status={r.status_code}, items={len(trend)}, tx_new={"tx_new" in fields}, fields={fields}')
