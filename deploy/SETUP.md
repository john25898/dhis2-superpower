# CI/CD setup — deploying to chakvista.co.ke

Every push to `main` deploys itself to the Ubuntu box and restarts the app.
Written against this specific server, not a generic one — the paths, user and
service name are the ones measured on 2026-10-01.

```
   git push origin main
          │
          ▼
   GitHub Actions  .github/workflows/deploy.yml
          │  joins the tailnet, then:
          │  ssh test@100.120.117.89        (over WireGuard, not the open internet)
          ▼
   deploy/deploy.sh
          │
          ├─ 1. git fetch + git reset --hard origin/main
          ├─ 2. pip install   (only if requirements.txt changed)
          ├─ 3. systemctl restart chakvista
          ├─ 4. poll http://127.0.0.1:5100/ until it answers
          └─ 5. health check failed? → roll back to the previous commit
```

### Why the runner does not just dial the box

The box is behind **carrier-grade NAT (CGNAT)**. Ping to its egress address
(`102.203.66.11`) answers, but every TCP port — 22, 80, 443 — is closed from the
public internet, and **no port-forward is possible**: the address is shared with
other subscribers, so it is an egress address rather than the box's own.

`chakvista.co.ke` therefore does **not** resolve to this box. It resolves to
Cloudflare, and a `cloudflared` tunnel running on the box connects **outward** to
Cloudflare and carries the public traffic in. That tunnel is inbound to nobody.

For deploys we use the other outbound path the box already has: **Tailscale**.
The box is already a node on the tailnet at **`100.120.117.89`**. The workflow
joins the same tailnet, which lets it reach that address even though neither end
is publicly reachable. Nothing is exposed to the internet.

---

## About this box

|                |                                                                   |
| -------------- | ----------------------------------------------------------------- |
| Repo deployed  | `john25898/dhis2-superpower` (**private**)                        |
| Clone          | `/opt/chakvista`                                                  |
| App dir        | `/opt/chakvista/train`                                            |
| venv           | `/opt/chakvista/venv`                                             |
| Deploy user    | `test`                                                            |
| Service        | `chakvista.service`                                               |
| Bound to       | `127.0.0.1:5100` (nginx terminates TLS)                           |
| Python         | 3.10.12                                                           |
| **Tailnet IP** | **`100.120.117.89`** — how the pipeline reaches the box           |
| Public entry   | Cloudflare edge → `cloudflared` tunnel → `127.0.0.1:8080` (nginx) |
| Inbound ports  | **none** — CGNAT, no port-forward is possible                     |
| nginx          | listens `0.0.0.0:8080`; ports 80/443 are held by **`lxd`**        |

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
- [x] **venv at `/opt/chakvista/venv`** built on Python 3.10.12; the full
      `pip install -r train/requirements.txt` succeeded, and importing `flask`,
      `pandas` and `openpyxl` all work.
- [x] **Credentials located**: `/home/test/dhistest/train/.env` exists (676 bytes).
      The running unit carries **no** credential `Environment=` lines, and
      `train/app.py` calls `load_dotenv()`, so a plain `.env` file is the whole
      mechanism — copying the file is enough. Nothing to move into the unit.
- [x] **Tailscale and Cloudflare Tunnel confirmed running** on the box
      (`tailscaled.service`, `cloudflared.service`). See the top of this file.

```bash
# what that rule contains
test ALL=(root) NOPASSWD: /usr/bin/systemctl restart chakvista, \
                           /usr/bin/systemctl is-active chakvista
```

> The paths must match `which systemctl`. On this box that is
> `/usr/bin/systemctl`. A mismatch surfaces later as
> \_"sudo: a password is required"\* during a deploy.

## What remains

- [ ] `train/.env` — copy it over and lock it to mode `600`
- [ ] **`openssh-server`** — the box has **no sshd running at all**; see Step 3
- [ ] install and start the unit (Step 2)
- [ ] the pipeline SSH key + `authorized_keys` (Step 3)
- [ ] a Tailscale auth key + the GitHub secrets (Step 4)
- [ ] first deploy (Step 5)

---

## Step 1 — credentials and the venv

`train/.env` holds the KHIS / CHAK / Gemini credentials. It is **gitignored**, so
it is never in the clone — it has to exist on disk.

The app is run with `WorkingDirectory=/opt/chakvista/train`, which is why
`python-dotenv` picks up `train/.env` with no `EnvironmentFile` line in the unit.

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

> **Already resolved.** A `.env` does exist on the old clone (676 bytes), and the
> running unit injects no credentials of its own — so the row above is the one
> that applies and the copy is all that is needed. The three-row table is kept
> because it is the thing to re-check if credentials ever go missing.

The venv is **already built** (`/opt/chakvista/venv`, Python 3.10.12, `deps OK`) —
skip the block below unless it is ever lost:

```bash
python3 -m venv /opt/chakvista/venv
/opt/chakvista/venv/bin/pip install --upgrade pip
/opt/chakvista/venv/bin/pip install -r /opt/chakvista/train/requirements.txt
/opt/chakvista/venv/bin/python -c "import flask, pandas, openpyxl; print('deps OK')"
```

> The install resolved on 3.10 without loosening any pin — it backtracks fairly
> hard on `google-api-core` / `grpcio-status` before settling, which is normal and
> not an error. It is idempotent: a second run reports
> `Requirement already satisfied` throughout.

---

## Step 2 — install the systemd unit

`deploy/chakvista.service` in this repo is the unit. It runs **gunicorn**, not the
Flask dev server.

### First: make sure the clone is actually current

**Do not skip this.** It is the step whose absence took the site down on
2026-10-01. The clone at `/opt/chakvista` had been made _before_ the commit that
fixed `User=deploy` → `User=test`, so the unit copied out of it pointed at an
account that does not exist. systemd failed with `status=217/USER`, gunicorn never
started, and nginx served **502** until the line was corrected.

```bash
git -C /opt/chakvista fetch origin --prune
git -C /opt/chakvista reset --hard origin/main
git -C /opt/chakvista log --oneline -1

# the poison check — this must print test, never deploy
grep -nE '^User=|^Group=' /opt/chakvista/deploy/chakvista.service
```

> Installed units are **not** deployed by `deploy.sh` — it only restarts the
> service, and its sudoers rule permits nothing more. So a unit change in the repo
> never reaches a live box on its own. Whenever you touch this file, the
> `git reset` + `cp` + `daemon-reload` below is a manual operation.

### Then install it

```bash
# Keep the old unit — it is the rollback path.
sudo cp /etc/systemd/system/chakvista.service ~/chakvista.service.bak 2>/dev/null

sudo cp /opt/chakvista/deploy/chakvista.service /etc/systemd/system/chakvista.service
sudo systemctl daemon-reload
sudo systemctl restart chakvista
sleep 8
systemctl status chakvista --no-pager | head -15

# The cold CHAK build takes ~47 s, so poll rather than checking once.
# Do NOT write `$(curl -w '%{http_code}' ... || echo 000)` — curl already prints
# 000 on failure, so the fallback appends a second one and you see "000000".
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://127.0.0.1:5100/)
  echo "attempt $i: HTTP $code"
  [ "$code" = "200" ] && break
  sleep 10
done
```

Expect `Active: active (running)` and eventually `HTTP 200`.

> **If it will not start, roll back before investigating:**
> `sudo cp ~/chakvista.service.bak /etc/systemd/system/chakvista.service &&
sudo systemctl daemon-reload && sudo systemctl restart chakvista`
>
> `status=217/USER` means the `User=` account cannot be resolved. `status=203/EXEC`
> means the `ExecStart` path is wrong. Neither is worth debugging live.

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

No change needed if the vhost already proxies to `127.0.0.1:5100`. Confirm — and
note the whole chain while you are here:

```bash
# -T dumps the *effective* config, includes and all.  Do not use
# `grep -r /etc/nginx/sites-enabled/`: those entries are symlinks into
# sites-available/, and grep -r does not follow symlinks, so it finds nothing
# and looks like nginx has no vhost at all.
sudo nginx -T 2>/dev/null | grep -nE 'listen |server_name|proxy_pass' | head -30

# the other half of the path, so the two can be compared side by side
sudo grep -nE 'hostname|service:' /etc/cloudflared/config.yml
```

Expected shape: `cloudflared` sends `chakvista.co.ke` to `http://127.0.0.1:8080`
(nginx), and nginx proxies on to `http://127.0.0.1:5100` (gunicorn). **If the final
hop is not `5100`, the new unit will start cleanly and the site will still serve
the old app.**

> **Confirmed on 2026-10-01** — the chain is exactly as expected, so the new unit's
> `--bind 127.0.0.1:5100` is correct as written:
>
> ```
> listen 8080;                          # nginx
> server_name _;
> proxy_pass http://127.0.0.1:5100;     # -> gunicorn
> ```
>
> No nginx change is needed. The `sudo nginx -T` line above is kept for the
> rebuild-the-box case.

If you do edit nginx, use `proxy_read_timeout 300s` — the cold CHAK build takes
~47 s and the default 60 s will cut it off.

---

## Step 3 — let the runner log in: an SSH key _and_ a way to reach the box

Two separate problems, and both must be solved:

1. There is **no route** to the box from the internet (CGNAT). → Tailscale.
2. There is **nothing listening** to log into. → install `openssh-server`.

### 3a — install sshd (it is not running on this box)

Measured on 2026-10-01: `systemctl is-active ssh` says **inactive**, and nothing
is bound to port 22. So the box currently has no SSH server at all.

```bash
sudo apt update && sudo apt install -y openssh-server
sudo systemctl enable --now ssh
systemctl is-active ssh          # expect: active
sudo ss -tlnp | grep -w ':22'    # expect: LISTEN ... 0.0.0.0:22
```

> It is safe to leave sshd on `0.0.0.0:22`. CGNAT means it cannot be reached
> from the public internet — the port scan from outside found 22 closed _before_
> sshd existed and will still find it closed after, because nothing forwards to
> it. Only the tailnet can reach it. If you want belt and braces, restrict who
> may connect in the Tailscale ACL rather than in `sshd_config`.

> **Check the firewall — this box has `ufw` installed.** `apt` runs a `ufw`
> trigger, and with `ufw` active on a default-deny policy, sshd will be listening
> and still refuse the tailnet connection. A connection that times out with sshd
> demonstrably up usually means exactly this:
>
> ```bash
> sudo ufw status verbose
> # if active and it does not already allow tailscale0:
> sudo ufw allow in on tailscale0
> sudo ufw reload
> ```
>
> `allow in on tailscale0` is narrower than `allow 22/tcp` — it only accepts
> traffic arriving over the encrypted tailnet interface, so your WAN-facing
> exposure is unchanged.

Also note the listener. Ubuntu's sshd came up on the **v6 wildcard**:

```
LISTEN 0 128 [::]:22 [::]:*  users:(("sshd",pid=39253,fd=4))
```

There is no separate `0.0.0.0:22` line, which looks wrong for an IPv4 connection
to `100.120.117.89`. It is not: with `net.ipv6.bindv6only=0` (the Ubuntu default)
that one socket also accepts IPv4 connections as v4-mapped addresses. Confirm with
`sysctl net.ipv6.bindv6only` — if it is `0`, nothing to do.

### 3b — the pipeline key

This is the **second** key, the opposite direction from the deploy key. Generate
it on the box, authorise the public half locally, then move the private half into
GitHub and delete the on-box copy.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/gha_deploy -N "" -C "github-actions -> box"
touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/gha_deploy.pub >> ~/.ssh/authorized_keys

# restricted entry: this key may only ever run the deploy script.
# (-N "" for ssh-keygen is "no passphrase".)
```

> Prefer to lock the key down? Replace the `authorized_keys` line with the same
> key prefixed by an `command=` forced command. Simple version — append exactly
> this instead, on one line, followed by the key text:
>
> ```
> command="/opt/chakvista/deploy/deploy.sh",no-port-forwarding,no-agent-forwarding,no-pty
> ```
>
> Optional. It means a leaked key cannot be used for anything except deploying.

Print the two values the workflow needs:

```bash
echo   "=== paste this whole block into the SSH_PRIVATE_KEY secret ==="
cat ~/.ssh/gha_deploy
echo
echo "=== and this into SSH_KNOWN_HOSTS ==="
ssh-keyscan -H 100.120.117.89
```

Note `100.120.117.89` — the **tailnet** address, not the domain. Then remove the
on-box copy: GitHub is the only thing that should hold it.

```bash
shred -u ~/.ssh/gha_deploy
```

> `~/.ssh/authorized_keys` must end with a newline before the `>>` append, or the
> new key merges onto the last line and is silently ignored. If the login fails
> with `Permission denied (publickey)`, check `tail -c 80 ~/.ssh/authorized_keys`.

### 3c — the Tailscale auth key

Tailscale admin console → **Settings → Keys → Generate auth key**:

| Setting   | Value                                      |
| --------- | ------------------------------------------ |
| Reusable  | **on** (every run creates a new node)      |
| Ephemeral | **on** (the node disappears after the run) |
| Tags      | **`tag:ci`**                               |
| Expiry    | whatever your policy allows                |

The tag matters: the workflow asks for `tag:ci`, and Tailscale rejects the
request unless the key is tagged with it.

Declare the tag in your ACL policy (admin console → **Access controls**) if it
is not already there:

```jsonc
{
  "tagOwners": {
    "tag:ci": ["munyelelelevin@"],
  },
  "acls": [
    { "action": "accept", "src": ["tag:ci"], "dst": ["100.120.117.89:22"] },
  ],
}
```

That grant is as narrow as it looks: a CI node may open exactly one port on
exactly one machine. If you already have an `acls` block, add the `accept` rule
to it rather than replacing the block.

---

## Step 4 — GitHub secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret              | Required    | Value                                               |
| ------------------- | ----------- | --------------------------------------------------- |
| `TAILSCALE_AUTHKEY` | ✅          | the `tskey-auth-…` key from Step 3c                 |
| `SSH_PRIVATE_KEY`   | ✅          | the private key printed in Step 3b                  |
| `SSH_HOST`          | no          | defaults to `100.120.117.89`                        |
| `SSH_USER`          | no          | defaults to `test`                                  |
| `SSH_KNOWN_HOSTS`   | recommended | `ssh-keyscan -H 100.120.117.89` output from Step 3b |
| `SSH_PORT`          | no          | defaults to 22                                      |
| `REPO_DIR`          | no          | already defaults to `/opt/chakvista`                |
| `SERVICE_NAME`      | no          | already defaults to `chakvista`                     |

Until `TAILSCALE_AUTHKEY` is set the workflow skips itself with a notice instead
of failing, so a green-but-skipped run before you finish this step is expected.

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
curl -s --max-time 180 localhost:5100/api/milestone/data | python3 -c '
import json, sys
d = json.load(sys.stdin)
if not d.get("ok"):
    # A cold CHAK build answers 202 with ok=False, warming=True. Retry.
    print("not ready:", d.get("warming"), d.get("error") or d.get("message"))
    raise SystemExit(0)
print("months :", [m["key"] for m in d["months"]])
k = d.get("khis") or {}
print("asOf   :", k.get("asOfHuman"), f"({k.get('asOf')})")
print("khis   :", k.get("status"), "| pinned:", k.get("pinnedFor"))
'
```

```
months : ['baseline', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']
asOf   : August 2026 (202608)
khis   : ok | pinned: August 2026
```

> The single-quoted outer shell means no `\` continuations and no escaping of
> the inner quotes — write the Python exactly as shown.
>
> `asOf` is the period key (`202608`) and `asOfHuman` is its label. `pinnedFor`
> is present only when CHAK actually has returns for the pinned month; if it is
> `None`, read `khis.note` — the payload says plainly that it fell back to the
> latest reporting month.

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
echo "--- what is listening, and who owns it ---"
sudo ss -tlnp | grep -E ':(22|80|443|8080|5100|5101)\b'
echo "--- the chain from the edge to the app ---"
sudo grep -nE 'hostname|service:' /etc/cloudflared/config.yml
sudo nginx -T 2>/dev/null | grep -nE 'listen |server_name|proxy_pass'

echo
echo "=== REMOTE ACCESS ==="
systemctl is-active ssh cloudflared tailscaled
tailscale ip -4
tailscale status | head -5

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
| Actions cannot connect at all, `Connection refused`          | **`openssh-server` not installed** — nothing on port 22               | Step 3a                                                                  |
| Actions cannot connect, **connection times out**             | `ufw` active and not allowing `tailscale0`                            | `sudo ufw status verbose`, then Step 3a                                  |
| Actions hangs, then `tailscale ping` times out               | runner's `tag:ci` node has no ACL route to the box                    | Step 3c — check `tagOwners` and the `accept` rule                        |
| `requested tags [tag:ci] are invalid or not permitted`       | auth key is not tagged `tag:ci`, or the tag is not in the ACL         | regenerate the key with the tag; declare it in `tagOwners`               |
| `sudo: a password is required`                               | sudoers path for `systemctl` is wrong                                 | `which systemctl`, fix `/etc/sudoers.d/chakvista-deploy`                 |
| Unit fails instantly, `status=217/USER`                      | the `User=` account does not exist on this box                        | Step 2 — stale clone shipped `User=deploy`; must be `test`               |
| Unit fails instantly, `status=203/EXEC`                      | `ExecStart` path does not exist                                       | `ls -l /opt/chakvista/venv/bin/gunicorn`; rebuild the venv if missing    |
| Site returns **502**                                         | nginx is up but the app is not listening on 5100                      | `systemctl status chakvista`; `sudo ss -tlnp \| grep 5100`               |
| Worker starts then hangs, nothing on 5100                    | `run_flask:app` used as the target                                    | use `app:app`                                                            |
| Connection refused right after a restart                     | still booting; the app pre-warms                                      | wait ~60 s; `journalctl -u chakvista -f`                                 |
| Health check times out, rollback succeeds                    | the commit genuinely fails to boot                                    | `journalctl -u chakvista -n 200 --no-pager`; fix forward                 |
| Deploy says OK but the site shows old code                   | stale `ExecStart` path, or nginx proxying to a different port         | `systemctl cat chakvista`; compare with the `proxy_pass` port            |
| Site slow / `Failed to load milestone data`, first load only | CHAK cold build ~47 s                                                 | expected; the app pre-warms at boot                                      |
| Need a real CHAK re-pull after a code change                 | 300 s in-process analytics cache; `?refresh=1` does **not** bypass it | restart (which a deploy does) — a page reload does not                   |
| `detected dubious ownership in repository`                   | `.git` owned by a different user than the deploy user                 | already handled by `deploy.sh`; else `chown -R test:test /opt/chakvista` |
