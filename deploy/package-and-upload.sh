#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PACKAGE_NAME="tangtang-glucose-h5.tar.gz"
PACKAGE_PATH="$PROJECT_DIR/$PACKAGE_NAME"
SSH_KEY="${HOME}/.ssh/id_ed25519_tangtang"
REMOTE_HOST="root@47.113.192.204"
REMOTE_PATH="/www/wwwroot/$PACKAGE_NAME"
REMOTE_TEMP_PATH="${REMOTE_PATH}.uploading"
TEMP_PACKAGE="$(mktemp -t tangtang-glucose-h5)"

cleanup() {
  rm -f "$TEMP_PACKAGE"
}
trap cleanup EXIT

if [ ! -f "$PROJECT_DIR/package.json" ]; then
  printf 'Package failed: package.json not found in %s\n' "$PROJECT_DIR" >&2
  exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
  printf 'Upload failed: SSH key not found: %s\n' "$SSH_KEY" >&2
  exit 1
fi

printf 'Packaging %s\n' "$PACKAGE_NAME"
cd "$PROJECT_DIR"
COPYFILE_DISABLE=1 tar \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./uploads' \
  --exclude='./logs' \
  --exclude='./.env' \
  --exclude="./$PACKAGE_NAME" \
  --exclude='./test-results' \
  --exclude='./.superpowers' \
  --exclude='./.DS_Store' \
  -czf "$TEMP_PACKAGE" .

for required_file in \
  './package.json' \
  './package-lock.json' \
  './src/App.vue' \
  './server/index.js' \
  './prisma/schema.prisma' \
  './deploy/update-tangtang.sh'; do
  if ! tar -tzf "$TEMP_PACKAGE" | grep -Fx "$required_file" >/dev/null; then
    printf 'Package failed: required file missing: %s\n' "$required_file" >&2
    exit 1
  fi
done

mv "$TEMP_PACKAGE" "$PACKAGE_PATH"
chmod 644 "$PACKAGE_PATH"
printf 'Package ready: %s\n' "$PACKAGE_PATH"

printf 'Uploading to %s\n' "$REMOTE_PATH"
scp -i "$SSH_KEY" "$PACKAGE_PATH" "$REMOTE_HOST:$REMOTE_TEMP_PATH"
ssh -i "$SSH_KEY" "$REMOTE_HOST" \
  "mv '$REMOTE_TEMP_PATH' '$REMOTE_PATH' && ls -lh '$REMOTE_PATH'"

printf '\nUpload complete. The server has not been updated or restarted.\n'
