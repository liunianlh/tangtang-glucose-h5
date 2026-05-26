#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/www/wwwroot/tangtang-glucose-h5"
PKG="/www/wwwroot/tangtang-glucose-h5.tar.gz"
BACKUP_ROOT="/www/wwwroot/tangtang-backups"
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/tangtang-glucose-h5-${STAMP}"
TMP_DIR="/www/wwwroot/.tangtang-update-${STAMP}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

fail() {
  printf '\nUpdate failed: %s\n' "$1" >&2
  exit 1
}

cleanup() {
  if [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup ERR

if [ ! -f "$PKG" ]; then
  fail "package not found: $PKG"
fi

log "Extracting package"
mkdir -p "$TMP_DIR"
tar -xzf "$PKG" -C "$TMP_DIR"

if [ ! -f "$TMP_DIR/package.json" ]; then
  PACKAGE_JSON="$(find "$TMP_DIR" -maxdepth 3 -type f -name package.json | head -n 1 || true)"
  if [ -z "$PACKAGE_JSON" ]; then
    fail "package.json not found in uploaded package"
  fi

  INNER_DIR="$(dirname "$PACKAGE_JSON")"
  STAGE_DIR="${TMP_DIR}.stage"
  mv "$INNER_DIR" "$STAGE_DIR"
  rm -rf "$TMP_DIR"
  mv "$STAGE_DIR" "$TMP_DIR"
fi

if [ ! -f "$TMP_DIR/package.json" ]; then
  fail "invalid package layout"
fi

log "Keeping production .env"
if [ -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env" "$TMP_DIR/.env"
else
  printf 'Warning: %s/.env does not exist. Create it before starting the API.\n' "$APP_DIR"
fi

log "Installing dependencies"
cd "$TMP_DIR"
npm install

log "Syncing database schema"
npm run db:push

log "Building frontend"
npm run build

log "Backing up current version"
mkdir -p "$BACKUP_ROOT"
if [ -d "$APP_DIR" ]; then
  mv "$APP_DIR" "$BACKUP_DIR"
fi

log "Switching to new version"
mv "$TMP_DIR" "$APP_DIR"
cd "$APP_DIR"

log "Restarting API"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart tangtang-glucose-api --update-env || pm2 start ecosystem.config.cjs --env production
  pm2 save || true
else
  fail "pm2 command not found"
fi

log "Checking API health"
curl -fsS http://127.0.0.1:3001/api/health

printf '\nUpdate complete.\n'
