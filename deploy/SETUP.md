# CI/CD setup — deploying to chakvista.co.ke

Every push to `main` will deploy itself to the Ubuntu box and restart the app.
Roughly ten minutes of one-time setup, then you never touch the server again.

```
   git push origin main
          │
          ▼
   GitHub Actions  .github/workflows/deploy.yml
          │  ssh deploy@chakvista.co.ke
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

## Step 0 — discover what is actually on the box

Run this **on the Ubuntu machine**. It changes nothing; it only reports. Paste
the output back and the values below stop being guesses.

```bash
echo "=============== 1. WHERE IS THE CLONE ==============="
for d in /opt /srv /var/www "$HOME" /home/*; do
  find "$d" -maxdepth 3 -name .git -type d 2>/dev/null | while read -r g; do
    r="$(dirname "$g")"
    case "$(basename "$r")" in train) r="$(dirname "$r")";; esac
    echo "REPO_DIR=$r"
    git -C "$r" remote -v 2>/dev/null | head -2
    echo "  branch: $(git -C "$r" rev-parse --abbrev-ref HEAD 2>/dev/null)"
    echo "  commit: $(git -C "$r" rev-parse --short HEAD 2>/dev/null)"
    echo "  owner:  $(stat -c '%U:%G' "$r" 2>/dev/null)"
    echo "  dirty:  $(git -C "$r" status --porcelain 2>/dev/null | wc -l) modified tracked file(s)"
  done
done

echo
echo "=============== 2. HOW IS IT RUNNING ==============="
systemctl list-units --type=service --all 2>/dev/null | grep -iE 'chak|vista|flask|gunicorn|dhis' || echo "(no matching systemd unit)"
ps -eo user,pid,args | grep -iE 'gunicorn|run_flask|flask' | grep -v grep || echo "(no gunicorn/flask process)"

echo
echo "=============== 3. WHAT IS IN FRONT ==============="
systemctl is-active nginx 2>/dev/null && echo "nginx: active" || echo "nginx: not active"
systemctl is-active caddy 2>/dev/null && echo "caddy: active" || echo "caddy: not active"
sudo nginx -T 2>/dev/null | grep -A6 -iE 'server_name.*chakvista' | head -40 || echo "(nginx config not readable)"

echo
echo "=============== 4. PYTHON ==============="
python3 --version
echo "venv dirs: $(find /opt /srv /var/www -maxdepth 3 -name pyvenv.cfg 2>/dev/null | tr '\n' ' ')"

echo
echo "=============== 5. PORTS ==============="
sudo ss -tlnp | grep -E ':(5100|80|443)\b' || echo "(nothing on 5100/80/443)"
```

The three answers that matter:

| Question                                          | Where it goes                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| The folder holding the clone                      | secret `REPO_DIR` (default `/opt/chakvista`)                      |
| The user that owns it                             | secret `SSH_USER`                                                 |
| Whether a `chakvista` systemd unit already exists | if **yes**, Step 3 is mostly copying; if **no**, install the unit |

> **If the box was never a git clone** (files copied by hand or a zip), you get
> one extra step first: move the real data aside and clone fresh. `train/.env`
> holds the KHIS/CHAK/Gemini credentials and is gitignored, so keep that file —
> see "Starting from a non-git copy" at the bottom.

---

## Step 1 — a deploy user with passwordless sudo for one command

The pipeline runs as a normal user (`deploy`) rather than root, and that user
needs to be able to restart **exactly one** service without a password prompt.

```bash
# Create the user if it does not exist yet.
sudo adduser --disabled-password --gecos "" deploy

# Give it the one sudo right the deploy needs.  Note the NOPASSWD and the
# narrow command list — this is not blanket root.
sudo tee /etc/sudoers.d/deploy-chakvista >/dev/null <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart chakvista, \
                           /usr/bin/systemctl status chakvista, \
                           /usr/bin/systemctl is-active chakvista
EOF
sudo chmod 0440 /etc/sudoers.d/deploy-chakvista
sudo visudo -c          # must print "parsed OK"

# If the clone is owned by someone else, hand it over (adjust the path).
sudo chown -R deploy:deploy /opt/chakvista
```

> The `systemctl` path must match what `which systemctl` prints on the box. If
> it is `/bin/systemctl`, use that instead — a mismatch shows up as
> _"sudo: a password is required"_ during the deploy.

---

## Step 2 — an SSH key for the pipeline

Generate the keypair **on the box** so the private key never travels over a
channel you have not chosen.

```bash
sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/deploy_key -N "" -C "github-actions-deploy"

# Authorise it for the deploy user.
sudo -u deploy bash -c 'cat /home/deploy/.ssh/deploy_key.pub >> /home/deploy/.ssh/authorized_keys'
sudo chmod 600 /home/deploy/.ssh/authorized_keys

# Print the private half — you paste this into GitHub in Step 4, then remove it.
sudo cat /home/deploy/.ssh/deploy_key
```

Copy that whole block, **including** the `-----BEGIN` and `-----END` lines.

Also grab the host key so the workflow can pin it instead of trusting whatever
answers first:

```bash
ssh-keyscan -H chakvista.co.ke
```

Then delete the on-box copy of the private key — the pipeline is the only thing
that should hold it:

```bash
sudo shred -u /home/deploy/.ssh/deploy_key
```

---

## Step 3 — install the systemd unit

`deploy/chakvista.service` in this repo is the unit. It runs gunicorn instead of
the Flask dev server, with the same flags `render.yaml` uses and for the same
reasons (one worker, `gthread`, no `--preload`).

```bash
# From the clone on the box:
sudo cp /opt/chakvista/deploy/chakvista.service /etc/systemd/system/chakvista.service

# If the app is NOT at /opt/chakvista, or runs as a different user, edit those
# two lines before enabling it:
sudo nano /etc/systemd/system/chakvista.service

# Stop whatever is running the app today, so it does not hold port 5100.
sudo systemctl stop chakvista 2>/dev/null || true
#   ...and if it is a hand-started process instead:
#   pkill -f 'run_flask.py' ; pkill -f gunicorn

sudo systemctl daemon-reload
sudo systemctl enable --now chakvista
sleep 5
systemctl status chakvista --no-pager
curl -I http://127.0.0.1:5100/
```

Expect `HTTP/1.1 200 OK`. If you get connection-refused, read
`journalctl -u chakvista -n 50 --no-pager` — the usual causes are a wrong
`WorkingDirectory`, a missing venv, or a port already in use.

Point nginx at it if it is not already (only if you changed the port):

```nginx
location / {
    proxy_pass http://127.0.0.1:5100;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;   # the cold CHAK build can take ~47 s
}
```

---

## Step 4 — add the GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret            | Required    | Value                                      |
| ----------------- | ----------- | ------------------------------------------ |
| `SSH_HOST`        | ✅          | `chakvista.co.ke`                          |
| `SSH_USER`        | ✅          | `deploy`                                   |
| `SSH_PRIVATE_KEY` | ✅          | the private key printed in Step 2          |
| `SSH_KNOWN_HOSTS` | recommended | output of `ssh-keyscan -H chakvista.co.ke` |
| `SSH_PORT`        | no          | defaults to `22`                           |
| `REPO_DIR`        | no          | defaults to `/opt/chakvista`               |
| `SERVICE_NAME`    | no          | defaults to `chakvista`                    |

Until `SSH_HOST` exists the workflow skips itself with a notice rather than
failing, so merging `deploy.yml` early is harmless.

---

## Step 5 — first deploy (this is the catch-up)

The box is on an older commit; running the deploy once brings it to `main`.
Trigger it from **Actions → Deploy to chakvista.co.ke → Run workflow**, or just
run it by hand on the box to watch it work:

```bash
sudo -u deploy REPO_DIR=/opt/chakvista SERVICE_NAME=chakvista \
  bash /opt/chakvista/deploy/deploy.sh
```

Then confirm the newer payload — the tell is that the Baseline tab exists as
its own month and the pin is honoured:

```bash
curl -s localhost:5100/api/milestone/data | python3 -c \
  "import json,sys; d=json.load(sys.stdin); \
   print('months :', [m['key'] for m in d['month']]); \
   print('asOf   :', d['khis'].get('asOf')); \
   print('pinned :', d['khis'].get('pinnedFor'))"
```

Expected once this lands:

```
months : ['baseline', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']
asOf   : August 2026
pinned : August 2026
```

---

## Day-to-day

```bash
git add <files>
git commit -m "…"
git push origin main     # ← everything after this is automatic, ~1-2 min
```

Watch it under **Actions**. Each run posts a summary with the commit that went
live. If the health check fails, the run goes red **and the box rolls itself
back** — the site keeps serving the previous commit rather than breaking.

To deploy without pushing (re-run the current commit), use **Run workflow**.

---

## Troubleshooting

| Symptom                                               | Cause                                                                              | Fix                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Permission denied (publickey)`                       | public key not in `authorized_keys`, or wrong user                                 | Re-run Step 2's `cat … >> authorized_keys`                            |
| `sudo: a password is required`                        | sudoers path for `systemctl` is wrong                                              | `which systemctl`, update `/etc/sudoers.d/deploy-chakvista`           |
| `detected dubious ownership`                          | clone owned by another user                                                        | Already handled by the script; else `chown -R deploy:deploy`          |
| Health check times out, rollback succeeds             | the new commit genuinely fails to boot                                             | `journalctl -u chakvista -n 200 --no-pager`; fix forward              |
| Deploy says OK but the site shows old code            | nginx caching, or `SERVICE_NAME` points at a stale unit                            | `systemctl status chakvista`; check `proxy_pass` port                 |
| Site slow / `Failed to load milestone data`           | CHAK cold build (~47 s) on a cold cache                                            | Expected on first load; the app pre-warms at boot                     |
| Want to force a real CHAK re-pull after a code change | the analytics cache lives 300 s in-process and `?refresh=1` does **not** bypass it | A restart (which the deploy does) clears it — a reload alone does not |

---

## Starting from a non-git copy

If Step 0 shows no `.git` anywhere, the box has a hand-copied tree. Migrate it
once:

```bash
cd /opt
sudo mv chakvista chakvista.old                      # keep everything
sudo -u deploy git clone https://github.com/john25898/dhis2-superpower.git chakvista
sudo cp /opt/chakvista.old/train/.env /opt/chakvista/train/.env   # 🔑 the credentials
sudo chown -R deploy:deploy /opt/chakvista
bash /opt/chakvista/deploy/deploy.sh
```

`.env` is the only file worth carrying over — it is gitignored and holds the
CHAK / KHIS / Gemini credentials. Everything else is reproducible from the repo.

Once the site is confirmed up, `rm -rf /opt/chakvista.old`.

---

## Why this is safe

- **The pipeline holds one key, scoped to one user**, which can restart exactly
  one service. It cannot `rm -rf` the box or read other tenants' files.
- **`git reset --hard`, not `git pull`.** The remote is the truth on a deploy
  target; a merge conflict on the server can never block a release. Untracked
  files — `train/.env`, the disk caches — are never touched.
- **Dependencies install only when `requirements.txt` changed**, so a normal
  deploy is a reset plus a restart, a few seconds.
- **Every deploy is self-verifying and self-reverting.** A commit that breaks
  the boot sequence is rolled back automatically and the site stays up.
