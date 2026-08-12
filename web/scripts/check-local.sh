#!/usr/bin/env bash
# Run web checks (type-check / lint / build) against a fast local copy.
#
# Why: this repo lives on iCloud-synced storage where bulk sequential reads
# stall (tsc, eslint, and next dev never finish from the checkout). Running the
# same checks from a local /tmp copy with its own node_modules completes in
# seconds. The sync is file-by-file with per-file timeouts so a slow iCloud
# read can never hang the whole run, and already-copied files are skipped.
#
# Usage:
#   bash scripts/check-local.sh [type-check|lint|build|all]
#
# The local copy lives at ${WEB_CHECK_DIR:-/tmp/changers-web-check}. It is
# deliberately separate from the preview copy (/tmp/changers-web-preview) so
# check runs never disturb the running dev server.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="${WEB_CHECK_DIR:-/tmp/changers-web-check}"
CMD="${1:-type-check}"

# Prefer the tested Node 24 when it exists (the very new homebrew Node 26
# causes intermittent stalls with Next 16 in this environment).
if [[ -x /usr/local/bin/node && -x /usr/local/bin/npm ]]; then
  export PATH="/usr/local/bin:$PATH"
fi

echo "Syncing web source -> $DST ..."

python3 - "$SRC" "$DST" <<'PY'
import os
import subprocess
import sys

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)

SUBDIRS = ["app", "components", "lib", "public", "db", "types", "src"]
FILES = ["package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts",
         "next.config.ts", "eslint.config.mjs", "vitest.config.ts", ".env.local"]

def size(p):
    try:
        return os.path.getsize(p)
    except Exception:
        return -1

def copy_file(s, d):
    if os.path.exists(d):
        try:
            if os.path.getsize(d) == size(s) and size(s) >= 0:
                return True
        except Exception:
            pass
    try:
        subprocess.run(["cp", s, d], timeout=60, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.TimeoutExpired:
        return False

for sub in SUBDIRS:
    base = os.path.join(src, sub)
    if not os.path.isdir(base):
        continue
    for root, _dirs, names in os.walk(base):
        for name in names:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, src)
            target = os.path.join(dst, rel)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            copy_file(full, target)

for f in FILES:
    s = os.path.join(src, f)
    if os.path.exists(s):
        copy_file(s, os.path.join(dst, f))

# Prune stale files (deleted or renamed in the source) from the copy so a
# removed file never keeps shadowing the real one during checks.
for sub in SUBDIRS:
    base = os.path.join(dst, sub)
    if not os.path.isdir(base):
        continue
    for root, _dirs, names in os.walk(base):
        for name in names:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, dst)
            if not os.path.exists(os.path.join(src, rel)):
                try:
                    os.remove(full)
                except Exception:
                    pass
PY

if [[ ! -d "$DST/node_modules" ]]; then
  echo "Installing dependencies in $DST (first run only)..."
  (cd "$DST" && npm install --no-audit --no-fund)
fi

case "$CMD" in
  type-check|lint|build|test)
    echo "Running: npm run $CMD"
    (cd "$DST" && npm run "$CMD")
    ;;
  all)
    echo "Running: npm run type-check && npm run lint && npm run test && npm run build"
    (cd "$DST" && npm run type-check && npm run lint && npm run test && npm run build)
    ;;
  *)
    echo "Usage: $0 [type-check|lint|build|test|all]" >&2
    exit 2
    ;;
esac
