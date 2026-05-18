#!/usr/bin/env bash
# FlickPick deploy script.
#
# Usage:
#   ./scripts/deploy.sh qa            # build + deploy to qa.flickpick.mov
#   ./scripts/deploy.sh pro           # build + deploy to flickpick.mov (with confirm)
#   ./scripts/deploy.sh qa --dry-run  # build + show what WOULD be uploaded
#   ./scripts/deploy.sh qa --skip-build  # use existing dist/ (faster)
#
# Why this exists:
#   Manual deploys via individual curl commands kept missing chunk files
#   (badging-*.js, secondary index-*.js, css). When index.html went up
#   referencing assets that hadn't been uploaded yet, PRO broke for every
#   user until the missing files arrived. This script:
#     - builds (validated) before touching the FTP
#     - uploads ALL of dist/ in the right order:
#         1. /assets/* (hashed JS, CSS, chunks)
#         2. SW + workbox + register + manifest + icons + static files
#         3. index.html LAST so users never see a stale HTML pointing
#            to chunks that don't exist yet
#     - skips robots.txt and sitemap.xml (env-specific, managed manually)
#     - prints a per-file summary so you can spot anything unexpected

set -euo pipefail

# ── Args ─────────────────────────────────────────────────────────────
ENV="${1:-}"
DRY_RUN=0
SKIP_BUILD=0
for arg in "${@:2}"; do
  case "$arg" in
    --dry-run)    DRY_RUN=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

if [[ "$ENV" != "qa" && "$ENV" != "pro" ]]; then
  cat <<'USAGE' >&2
Usage:
  ./scripts/deploy.sh <env> [flags]

env:
  qa    Deploy to qa.flickpick.mov (/www/qa)
  pro   Deploy to flickpick.mov  (/www) — asks for confirmation

flags:
  --dry-run     Show what would be uploaded, don't touch FTP
  --skip-build  Reuse existing dist/ instead of running npm run build
USAGE
  exit 1
fi

# ── Config ───────────────────────────────────────────────────────────
FTP_USER="${FLICKPICK_FTP_USER:-flickpick}"
FTP_PASS="${FLICKPICK_FTP_PASS:-FlickFTP2024!deploy}"
FTP_HOST="ftp.flickpick.mov"
if [[ "$ENV" == "qa" ]]; then
  REMOTE_DIR="/www/qa"
  PUBLIC_URL="https://qa.flickpick.mov"
else
  REMOTE_DIR="/www"
  PUBLIC_URL="https://flickpick.mov"
fi

# Files whose content differs per-env and must NOT be auto-uploaded.
# robots.txt: QA has Disallow:/, PRO has the normal one.
# sitemap.xml: PRO-only, rarely changes.
EXCLUDE_REGEX='^(robots\.txt|sitemap\.xml)$'

# ── Confirmation for PRO ─────────────────────────────────────────────
if [[ "$ENV" == "pro" && "$DRY_RUN" -eq 0 ]]; then
  echo ""
  echo "⚠️  About to deploy to PRODUCTION ($PUBLIC_URL)"
  read -r -p "    Type 'pro' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "pro" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# ── Locate repo root (script lives in scripts/) ──────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Build ────────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" -eq 1 ]]; then
  echo "[1/4] Skipping build (--skip-build)"
else
  echo "[1/4] npm run build"
  npm run build
fi

# Sanity check
if [[ ! -f dist/index.html ]]; then
  echo "✗ dist/index.html missing — build did not produce expected output." >&2
  exit 1
fi
if [[ ! -d dist/assets ]]; then
  echo "✗ dist/assets/ missing — build did not produce expected output." >&2
  exit 1
fi

# ── Discover files to upload ─────────────────────────────────────────
# We split into three groups so we can upload in the right order.
echo "[2/4] Discovering files in dist/"

ASSETS_FILES=()
OTHER_FILES=()  # everything except dist/assets/* and dist/index.html

while IFS= read -r -d '' file; do
  rel="${file#dist/}"
  base="$(basename "$rel")"
  # Skip files that differ per-env
  if [[ "$base" =~ $EXCLUDE_REGEX ]]; then
    continue
  fi
  if [[ "$rel" == "index.html" ]]; then
    continue   # uploaded last separately
  fi
  if [[ "$rel" == assets/* ]]; then
    ASSETS_FILES+=("$rel")
  else
    OTHER_FILES+=("$rel")
  fi
done < <(find dist -type f -print0)

echo "    assets/    : ${#ASSETS_FILES[@]} files"
echo "    other      : ${#OTHER_FILES[@]} files"
echo "    index.html : 1 file (uploaded LAST)"

# ── Upload helper ────────────────────────────────────────────────────
upload_file() {
  local rel="$1"
  local local_path="dist/$rel"
  local remote_url="ftp://$FTP_HOST$REMOTE_DIR/$rel"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf "  [dry] %s\n" "$rel"
    return 0
  fi

  # curl --ftp-create-dirs makes nested folders if missing.
  # Capture output so we can surface real failures clearly.
  if ! curl -sS --fail --ftp-create-dirs \
       -T "$local_path" \
       --user "$FTP_USER:$FTP_PASS" \
       "$remote_url"; then
    echo "✗ Upload failed: $rel" >&2
    return 1
  fi
  printf "  ✓ %s\n" "$rel"
}

# ── 3. Upload assets/ first (hashed JS, CSS, chunks) ─────────────────
echo "[3/4] Uploading to $PUBLIC_URL ($REMOTE_DIR)"
echo "  → assets/ first (hashed chunks, must exist before index.html points to them)"
for f in "${ASSETS_FILES[@]}"; do
  upload_file "$f"
done

# ── 4. Upload other root files (sw.js, workbox, icons, manifest, etc.) ─
echo "  → root files (SW, workbox, manifest, icons, static images)"
for f in "${OTHER_FILES[@]}"; do
  upload_file "$f"
done

# ── 5. LAST: index.html (the contract — only swap pointer after all   ─
#                        chunks it references already exist remotely)  ─
echo "  → index.html (LAST — only after every chunk it references is live)"
upload_file "index.html"

# ── Done ─────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo ""
  echo "✅ Dry-run complete. Nothing uploaded."
else
  echo ""
  echo "✅ Deployed to $ENV: $PUBLIC_URL"
  echo "   Hard-reload in browser (Ctrl+Shift+R) to bypass SW cache while testing."
fi
