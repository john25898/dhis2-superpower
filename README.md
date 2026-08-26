# CHAK VISTA — DHIS2 Superpower

A professional Flask dashboard for CHAK health-programme analytics (Kenya). It reads
live data from CHAK DHIS2 (`ereporting.chak.or.ke`) and KHIS (`hiskenya.dha.go.ke`)
and renders per-project dashboards, charts and MHU workload views.

## Stack

- **Backend:** Flask (Python), organised as `train/blueprints/` + `train/services/`
- **Frontend:** vanilla JS SPA (no build step) served from `train/js/`
- **Project configs:** one folder per project in `train/projects/<slug>/`
- **Deployment:** Render (see `render.yaml`) with gunicorn

## Run locally

```bash
cd train
python run_flask.py 5055
```

Then open http://127.0.0.1:5055

## Layout

```
train/
  app.py                 — Flask app factory (create_app)
  run_flask.py           — dev server entry point
  blueprints/            — route modules (core, chat, mhu, hiv, portfolio, chak_explore, pbix)
  services/              — pure logic (paths, dhis2, khis, superpower, ai, database, ...)
  projects/              — one folder per project (config.js + charts + backend + data)
    <slug>/config.js     — project config (datasets, dashboards, visualizations)
  js/                    — shared SPA scripts (core.js, chak-*.js, ...)
  data/                  — data files
  index.html             — SPA shell (loads project configs before core.js)
```

## DHIS2 / KHIS access

Credentials live in `train/.env` (DHIS*\*, KHIS*_, GEMINI\__, GROQ\_\*). The app falls
back to built-in defaults if `.env` is missing.

## Superpower (AI query engine)

`ai_translator.py` (repo root) provides natural-language → DHIS2 query translation.
The Flask app imports it lazily via `train/services/superpower.py`; if it is missing
the app still runs but the AI query features degrade to direct DHIS2 calls.

## Data sources

- `dictionaries/` — master data-element / facility lookups used by the app
- `data.csv`, `data2.csv` — PBIX-exported facility data (MHU cascading filters)
- `Key Indicators Drill down.csv` — key-indicator drill-down data
