#!/usr/bin/env bash
# Build the game and publish dist/ to the gh-pages branch of `origin`.
# Fallback for when GitHub Actions can't be used (e.g. a token without the `workflow` scope).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
REMOTE_URL="$(git remote get-url origin)"
TMP="$(mktemp -d)"
cp -R dist/. "$TMP"/
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git -c credential.helper="$(git -C "$OLDPWD" config --get credential.helper || true)" push -f "$REMOTE_URL" gh-pages
rm -rf "$TMP"
echo "Published to gh-pages."
