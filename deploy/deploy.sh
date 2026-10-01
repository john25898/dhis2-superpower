#!/usr/bin/env bash
# ============================================================================
#  CHAK VISTA — server-side deploy script
#
#  Idempotent.  It is run by .github/workflows/deploy.yml over SSH on every
#  push to main, and it is safe to run by hand on the box:
#
#      bash /opt/chakvista/deploy/deploy.sh
#
#  What it does:
#     1. fetch origin and hard-reset the clone to origin/<branch>
#     2. install Python deps, but ONLY if train/requirements.txt changed
#     3. restart the systemd service
#     4. poll the app until it answers
#     5. if it never answers, roll the code back to the commit that was live
#        before this run and restart — a bad push cannot leave the site down
#
#  Every path is overridable with an environment variable so the same script
#  works on a differently laid-out box.  The workflow passes these through.
#
#      REPO_DIR        /opt/chakvista     the git clone
#      APP_DIR         $REPO_DIR/train    the Flask app (render.yaml rootDir)
#      VENV_DIR        $REPO_DIR/venv     virtualenv for gunicorn + deps
#      SERVICE_NAME    chakvista          systemd unit to restart
#      BRANCH          main
#      HEALTH_URL      http://127.0.0.1:5100/
#      HEALTH_TIMEOUT  120                seconds to wait for the app
#      PYTHON          python3            interpreter used to build the venv
# ============================================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/chakvista}"
APP_DIR="${APP_DIR:-$REPO_DIR/train}"
VENV_DIR="${VENV_DIR:-$REPO_DIR/venv}"
SERVICE_NAME="${SERVICE_NAME:-chakvista}"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:5100/}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
PYTHON="${PYTHON:-python3}"

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!! %s\033[0m\n' "$*"; }

# ── preflight ───────────────────────────────────────────────────────────────
[ -d "$REPO_DIR/.git" ] || { warn "No git clone at $REPO_DIR"; exit 1; }
[ -f "$APP_DIR/requirements.txt" ] || { warn "No requirements.txt at $APP_DIR"; exit 1; }

cd "$REPO_DIR"

# If the deploy user is not the user that created the clone, git refuses to
# touch it ("dubious ownership").  Trust just this path rather than the whole
# filesystem.
if [ "$(stat -c '%U' "$REPO_DIR/.git" 2>/dev/null || echo '?')" != "$(id -un)" ]; then
  git config --global --add safe.directory "$REPO_DIR"
fi

# ── 1. bring the clone up to date ───────────────────────────────────────────
log "Fetching origin/$BRANCH"
git fetch --prune origin

PREV="$(git rev-parse HEAD)"
NEXT="$(git rev-parse "origin/$BRANCH")"

if [ "$PREV" = "$NEXT" ]; then
  log "Already at $(git rev-parse --short HEAD) — no new commits, redeploying anyway"
else
  log "Moving $(git rev-parse --short "$PREV") -> $(git rev-parse --short "$NEXT")"
fi

# Hard reset, not pull: this is a deploy target, so the remote is the truth.
# Untracked files are left alone, which keeps train/.env and the disk caches.
git reset --hard "$NEXT"

# ── 2. dependencies (only when they actually changed) ───────────────────────
if [ ! -x "$VENV_DIR/bin/python" ]; then
  log "Creating virtualenv at $VENV_DIR"
  "$PYTHON" -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --upgrade pip
  log "Installing requirements (first time — this takes a few minutes)"
  "$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"
elif ! git diff --quiet "$PREV" "$NEXT" -- train/requirements.txt; then
  log "train/requirements.txt changed — installing"
  "$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"
else
  log "train/requirements.txt unchanged — skipping install"
fi

# ── 3 & 4. restart and wait for it to answer ────────────────────────────────
restart_and_check() {
  log "Restarting $SERVICE_NAME"
  sudo -n systemctl restart "$SERVICE_NAME"

  log "Waiting for $HEALTH_URL (up to ${HEALTH_TIMEOUT}s)"
  local waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL"; then
      log "Healthy after ${waited}s"
      return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

if restart_and_check; then
  log "SUCCESS — $(git rev-parse --short HEAD) is live"
  exit 0
fi

# ── 5. rollback ─────────────────────────────────────────────────────────────
warn "HEALTH CHECK FAILED on $(git rev-parse --short HEAD)"

if [ "$PREV" = "$NEXT" ]; then
  warn "Nothing to roll back to — the failing commit was already live."
  warn "Inspect the logs:  journalctl -u $SERVICE_NAME -n 200 --no-pager"
  exit 1
fi

warn "Rolling back to $(git rev-parse --short "$PREV")"
git reset --hard "$PREV"
"$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt" || true

if restart_and_check; then
  warn "Rolled back to $(git rev-parse --short HEAD) — the site is UP on the previous code."
  warn "The push was NOT deployed. Fix forward, then push again."
else
  warn "Rollback ALSO failed to come up. The site is down."
  warn "Inspect the logs:  journalctl -u $SERVICE_NAME -n 200 --no-pager"
fi

exit 1
