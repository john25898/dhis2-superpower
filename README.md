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

## Deployment

Production is https://chakvista.co.ke, served from an Ubuntu box that sits
behind CGNAT — no inbound ports are reachable, so the box is reached over
Tailscale instead:

```
Cloudflare edge
  → cloudflared   (on the box)
  → nginx         127.0.0.1:8080
  → gunicorn      127.0.0.1:5100  (chakvista.service)
```

Pushing to `main` deploys automatically via `.github/workflows/deploy.yml`: the
runner joins the tailnet as an ephemeral node, SSHes to the box, and runs
`deploy/deploy.sh` — which fetches, `git reset --hard`s to the pushed commit,
restarts `chakvista.service`, health-checks it and rolls back if it fails.

The workflow is a no-op until these repository secrets exist
(Settings → Secrets and variables → Actions):

| Secret              | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| `TAILSCALE_AUTHKEY` | Tailscale auth key — reusable + ephemeral, **tags empty**              |
| `SSH_PRIVATE_KEY`   | private key whose public half is in the box's `~/.ssh/authorized_keys` |
| `SSH_KNOWN_HOSTS`   | `ssh-keyscan -H <tailnet-ip> 2>/dev/null \| grep -v '^#'`              |

`SSH_HOST`, `SSH_USER`, `SSH_PORT`, `REPO_DIR` and `SERVICE_NAME` are optional —
they default to the live box's values. One-time host setup (service unit,
sudoers, key placement) is documented in `deploy/SETUP.md`.

## DHIS2 / KHIS access

Credentials live in `train/.env` (DHIS*\*, KHIS*\_, GEMINI\_\_, GROQ\_\*). The app falls
back to built-in defaults if `.env` is missing.

## Superpower (AI query engine)

`ai_translator.py` (repo root) provides natural-language → DHIS2 query translation.
The Flask app imports it lazily via `train/services/superpower.py`; if it is missing
the app still runs but the AI query features degrade to direct DHIS2 calls.

## Data sources

- `dictionaries/` — master data-element / facility lookups used by the app
- `data.csv`, `data2.csv` — PBIX-exported facility data (MHU cascading filters)
- `Key Indicators Drill down.csv` — key-indicator drill-down data.
