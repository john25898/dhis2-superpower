# CI/CD setup — deploying to chakvista.co.ke

Every push to `main` deploys itself to the Ubuntu box and restarts the app.
Written against this specific server, not a generic one — the paths, user and
service name are the ones measured on 2026-10-01.

```
   git push origin main
          │
          ▼
   GitHub Actions  .github/workflows/deploy.yml
          │  ssh test@<box>
          ▼
   deploy/deploy.sh
          │
          ├─ 1. git fetch + git reset --hard origin/main
          ├─ 2. pip install   (only if requirements.txt changed)
          ├─ 3. systemctl restart chakvista
          ├─ 4. poll http://127.0.0.1:5100/ until it answers
          └─ 5. health check failed? → roll back to the previous commit
```

---

## About this box

|               |                                                                    |
| ------------- | ------------------------------------------------------------------ |
| Repo deployed | `john25898/dhis2-superpower` (**private**)                         |
| Clone         | `/opt/chakvista`                                                   |
| App dir       | `/opt/chakvista/train`                                             |
| venv          | `/opt/chakvista/venv`                                              |
| Deploy user   | `test`                                                             |
| Service       | `chakvista.service`                                                |
| Bound to      | `127.0.0.1:5100` (nginx terminates TLS)                            |
| Python        | 3.10.12                                                            |
| Web server    | nginx active; ports 80/443 are held by **`lxd`**, which proxies in |

> **There are two SSH keys in this setup, and they point in opposite
> directions.** Confusing them is the most common way to lose an afternoon:
>
> | Key                       | Direction                                   | Where it lives                                       |
> | ------------------------- | ------------------------------------------- | ---------------------------------------------------- |
> | `~/.ssh/chakvista_deploy` | **box → GitHub** (read the repo)            | on the server, public half in the repo's Deploy keys |
> | the pipeline key          | **GitHub runner → box** (log in and deploy) | private half in the `SSH_PRIVATE_KEY` secret         |

---

## What is already done

Checked off on 2026-10-01. Do not redo these.

- [x] **Clone at `/opt/chakvista`** on `main`, from `git@github.com:john25898/dhis2-superpower.git`.
- [x] **Read-only deploy key** generated at `~/.ssh/chakvista_deploy`, public half
      added to _Settings → Deploy keys_. Verified: `ssh -T git@github.com` replies
      `Hi john25898/dhis2-superpower!`
- [x] **`~/.ssh/config`** pins that key for `github.com`. This is what lets
      `deploy.sh` run `git fetch` unattended — without it, fetch fails with no
      terminal to prompt on.
- [x] **sudoers rule** at `/etc/sudoers.d/chakvista-deploy`; `visudo -c` says
      _parsed OK_. Grants exactly two commands, no blanket root.

```bash
# what that rule contains
test ALL=(root) NOPASSWD: /usr/bin/systemctl restart chakvista, \
                           /usr/bin/systemctl is-active chakvista
```

> The paths must match `which systemctl`. On this box that is
> `/usr/bin/systemctl`. A mismatch surfaces later as
> \_"sudo: a password is required"\* during a deploy.

## What remains

- [ ] `train/.env` — **credentials. Status unknown; see Step 1.**
- [ ] venv at `/opt/chakvista/venv` + `pip install`
- [ ] install and start the unit (Step 2)
- [ ] the pipeline SSH key + `authorized_keys` (Step 3)
- [ ] GitHub secrets (Step 4)
- [ ] first deploy (Step 5)

---

## Step 1 — credentials and the venv

`train/.env` holds the KHIS / CHAK / Gemini credentials. It is **gitignored**, so
it is never in the clone — it has to exist on disk.

Before copying anything, find out where the currently-running app gets its
credentials. The old unit may inject them as `Environment=` lines instead of
using a file:

```bash
echo "=== where do credentials come from today? ==="
systemctl cat chakvista | grep -iE 'Environment|EnvironmentFile|WorkingDirectory|ExecStart'

echo
echo "=== is there a .env on the old clone? ==="
ls -la /home/test/dhistest/train/.env 2>/dev/null && echo "FOUND" || echo "MISSING"

echo
echo "=== where does the app actually read them from? ==="
grep -nE "load_dotenv|getenv|environ" /opt/chakvista/train/app.py | head -20
```

Three possible outcomes:

| What you see                                       | What to do                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A `.env` exists on the old clone                   | `cp` it across (below)                                                                                       |
| No `.env`, but `Environment=DHIS_USERNAME=…` lines | **Do not copy an env file** — move those lines into the new unit (Step 2), and treat the file as nonexistent |
| Neither                                            | The credentials are already in `app.py`/config as defaults. Confirm with the `grep`, then continue           |

```bash
# only if a .env actually exists
cp /home/test/dhistest/train/.env /opt/chakvista/train/.env
chmod 600 /opt/chakvista/train/.env
wc -l /opt/chakvista/train/.env      # sanity: should be non-empty
```

Then the venv. Note the app is run with `WorkingDirectory=/opt/chakvista/train`,
which is why `python-dotenv` picks up `train/.env` with no `EnvironmentFile` line
in the unit.

```bash
python3 -m venv /opt/chakvista/venv
/opt/chakvista/venv/bin/pip install --upgrade pip
/opt/chakvista/venv/bin/pip install -r /opt/chakvista/train/requirements.txt
/opt/chakvista/venv/bin/python -c "import flask, pandas, openpyxl; print('deps OK')"
```

If `requirements.txt` fails on the `google-generativeai` pin under Python 3.10,
say so — the pins were resolved on 3.13 and one may need loosening.

---

## Step 2 — install the systemd unit

`deploy/chakvista.service` in this repo is the unit. It runs **gunicorn**, not the
Flask dev server.

```bash
# Keep the old unit if you want to compare — the credentials may be in it.
sudo cp /etc/systemd/system/chakvista.service ~/chakvista.service.bak 2>/dev/null

sudo cp /opt/chakvista/deploy/chakvista.service /etc/systemd/system/chakvista.service
sudo systemctl daemon-reload
sudo systemctl restart chakvista
sleep 6
systemctl status chakvista --no-pager
curl -I http://127.0.0.1:5100/
```

Expect `HTTP/1.1 200 OK`.

### Two deliberate differences from the old unit

The old unit ran `--workers 2 … run_flask:app`. The new one runs
`--workers 1 --threads 4 … app:app`. Both changes are intentional:

- **Target `app:app`, not `run_flask:app`.** `run_flask.py` calls `app.run()` at
  module level with no `__main__` guard, so gunicorn importing it would start the
  dev server _inside_ the worker and deadlock. `app.py` exposes a plain module-level
  `app` object instead.
- **One worker with threads.** The app holds a large in-process payload cache, two
  parsed Excel workbooks and a boot-time pre-warm thread. A second worker duplicates
  all of it — and each worker would pull its own copy from CHAK and its own 300 s
  cache, so the two would disagree. `--worker-class gthread` is required for
  `--threads` to do anything; the default `sync` class ignores it.

No `--preload`: the app starts a background thread at import time, and preloading
forks a worker while the build lock is held.

> **Rolling back.** If the new unit misbehaves:
> `sudo cp ~/chakvista.service.bak /etc/systemd/system/chakvista.service &&
sudo systemctl daemon-reload && sudo systemctl restart chakvista`
> — or just point `WorkingDirectory`/`ExecStart` back at `/home/test/dhistest`,
> which is untouched and still works.

### nginx

No change needed if the vhost already proxies to `127.0.0.1:5100`. Confirm:

```bash
sudo nginx -T 2>/dev/null | grep -B4 -A8 'proxy_pass' | head -40
```

If you do edit it, use `proxy_read_timeout 300s` — the cold CHAK build takes ~47 s
and the default 60 s will cut it off.

---

## Step 3 — a key so GitHub can log into the box

This is the **second** key, the opposite direction from the deploy key. Generate
it on the box, authorise the public half locally, then move the private half into
GitHub and delete the on-box copy.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/gha_deploy -N "" -C "github-actions -> box"
cat ~/.ssh/gha_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

echo   "=== paste this whole block into the SSH_PRIVATE_KEY secret ==="
cat ~/.ssh/gha_deploy
echo   "=== and this into SSH_KNOWN_HOSTS ==="
ssh-keyscan -H chakvista.co.ke
```

Copy both, then remove the on-box copy — GitHub is the only thing that should hold it:

```bash
shred -u ~/.ssh/gha_deploy
```

> `~/.ssh/authorized_keys` must end with a newline before the `>>` append, or the
> new key merges onto the last line and is silently ignored. If the login fails
> with `Permission denied (publickey)`, check `tail -c 80 ~/.ssh/authorized_keys`.

### One thing to verify before going further

The workflow connects to `chakvista.co.ke` on **port 22**. That is not necessarily
the same machine as the web host — nginx sits behind an LXD proxy here, and the
domain may resolve to an LXD host rather than to this box.

```bash
curl -s ifconfig.me                                   # this box's public IP
getent hosts chakvista.co.ke                           # what the domain resolves to
```

- **They match** → use `SSH_HOST=chakvista.co.ke`.
- **They differ** → use the box's public IP directly, or a port-forward, or
  [Tailscale](https://tailscale.com) (which also avoids opening 22 to the
  internet). Set `SSH_HOST` and `SSH_PORT` to match whichever you pick.

If these differ, the domain is only the _web_ entry point and pointing the
pipeline at it will time out.

---

## Step 4 — GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret            | Required    | Value                                                                  |
| ----------------- | ----------- | ---------------------------------------------------------------------- |
| `SSH_HOST`        | ✅          | box IP or `chakvista.co.ke` — whichever resolved to this box in Step 3 |
| `SSH_USER`        | ✅          | `test`                                                                 |
| `SSH_PRIVATE_KEY` | ✅          | the private key printed in Step 3                                      |
| `SSH_KNOWN_HOSTS` | recommended | `ssh-keyscan -H <host>` output                                         |
| `SSH_PORT`        | if not 22   | only if you used a forward or Tailscale                                |
| `REPO_DIR`        | no          | already defaults to `/opt/chakvista`                                   |
| `SERVICE_NAME`    | no          | already defaults to `chakvista`                                        |

Until `SSH_HOST` is set the workflow skips itself with a notice instead of failing,
so a green-but-skipped run before you finish this step is expected.

---

## Step 5 — first deploy

Run it by hand first, so you can watch it rather than read about it:

```bash
bash /opt/chakvista/deploy/deploy.sh
```

Expected shape:

```
==> Fetching origin/main
==> Already at 434d1b8 — no new commits, redeploying anyway
==> Creating virtualenv at /opt/chakvista/venv        (or: skipping install)
==> Restarting chakvista
==> Waiting for http://127.0.0.1:5100/ (up to 120s)
==> Healthy after 9s
==> SUCCESS — 434d1b8 is live
```

Then confirm the newer payload. The tell is that `baseline` exists as its own
month — the whole point of this migration:

```bash
curl -s localhost:5100/api/milestone/data | python3 -c \
  "import json,sys; d=json.load(sys.stdin); \
   print('months :', [m['key'] for m in d['month']]); \
   print('asOf   :', d['khis'].get('asOf')); \
   print('pinned :', d['khis'].get('pinnedFor'))"
```

```
months : ['baseline', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']
asOf   : August 2026
pinned : August 2026
```

Only then wire up the automatic path — push to `main`, watch **Actions**, confirm
the summary table names the commit that went live.

---

## Day-to-day

```bash
git add <files>
git commit -m "…"
git push origin main     # ← everything after this is automatic, ~1-2 min
```

Each run posts a summary with the commit that went live. If the health check fails,
the run goes red **and the box rolls itself back** — the site keeps serving the
previous commit rather than going down.

To redeploy the current commit without pushing, use **Run workflow** in the Actions tab.

---

## The old clone is your fallback

`/home/test/dhistest` is **not deleted and not touched** by any of this. It is
pinned at `102d363` and has **32 modified tracked files** whose history is unclear.

Leave it alone until the new deployment has been serving happily for a while. If
anything is ever wrong, that clone plus its venv still runs the site — point the
unit back at it and restart.

It is only safe to delete once you are confident the new stack is stable. Note that
`deploy.sh` does `git reset --hard`, so **never point it at that clone** until you
have reviewed the 32 files:

```bash
cd /home/test/dhistest && git status --porcelain && git diff --stat | tail -5
```

There is also a leftover second copy at `~/Downloads/dhistest` — same commit, same
32 dirty files. It is not wired to anything and can be removed whenever convenient.

---

## Appendix — re-running discovery

If the box is ever rebuilt, this reports the layout again. It only reads.

```bash
echo "=== CLONES ==="
for d in /opt /srv /var/www "$HOME" /home/*; do
  find "$d" -maxdepth 3 -name .git -type d 2>/dev/null | while read -r g; do
    r="$(dirname "$g")"; case "$(basename "$r")" in train) r="$(dirname "$r")";; esac
    echo "REPO_DIR=$r"
    git -C "$r" remote get-url origin 2>/dev/null
    echo "  commit: $(git -C "$r" rev-parse --short HEAD 2>/dev/null)"
    echo "  owner:  $(stat -c '%U:%G' "$r" 2>/dev/null)"
    echo "  dirty:  $(git -C "$r" status --porcelain 2>/dev/null | wc -l)"
  done
done

echo
echo "=== SERVICE ==="
systemctl cat chakvista 2>/dev/null | grep -E 'User|WorkingDirectory|ExecStart'
systemctl is-active chakvista

echo
echo "=== FRONT DOOR ==="
systemctl is-active nginx
sudo ss -tlnp | grep -E ':(80|443|5100)\b'

echo
echo "=== SUDO ==="
sudo -n true 2>/dev/null && echo "sudo -n OK" || echo "sudo -n NEEDS A PASSWORD"
```

---

## Troubleshooting

| Symptom                                                      | Cause                                                                 | Fix                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Permission denied (publickey)` on clone                     | deploy key not added, or `~/.ssh/config` missing                      | `ssh -T git@github.com` should name **dhis2-superpower**                 |
| `Permission denied (publickey)` on deploy                    | pipeline key not in `authorized_keys`, or missing trailing newline    | `tail -c 80 ~/.ssh/authorized_keys`                                      |
| `Permission denied (publickey)` from Actions only            | `SSH_HOST` resolves to a different machine                            | compare `curl ifconfig.me` with `getent hosts`                           |
| `sudo: a password is required`                               | sudoers path for `systemctl` is wrong                                 | `which systemctl`, fix `/etc/sudoers.d/chakvista-deploy`                 |
| Worker starts then hangs, nothing on 5100                    | `run_flask:app` used as the target                                    | use `app:app`                                                            |
| Connection refused right after a restart                     | still booting; the app pre-warms                                      | wait ~60 s; `journalctl -u chakvista -f`                                 |
| Health check times out, rollback succeeds                    | the commit genuinely fails to boot                                    | `journalctl -u chakvista -n 200 --no-pager`; fix forward                 |
| Deploy says OK but the site shows old code                   | stale `ExecStart` path, or nginx cached                               | `systemctl cat chakvista`; check `proxy_pass` port                       |
| Site slow / `Failed to load milestone data`, first load only | CHAK cold build ~47 s                                                 | expected; the app pre-warms at boot                                      |
| Need a real CHAK re-pull after a code change                 | 300 s in-process analytics cache; `?refresh=1` does **not** bypass it | restart (which a deploy does) — a page reload does not                   |
| `detected dubious ownership in repository`                   | `.git` owned by a different user than the deploy user                 | already handled by `deploy.sh`; else `chown -R test:test /opt/chakvista` |
