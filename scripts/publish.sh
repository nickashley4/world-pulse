#!/bin/sh
# Refresh data, commit, and push (GitHub Pages redeploys automatically).
set -e
cd "$(dirname "$0")/.."
npm run refresh
git add docs/data data
if git diff --cached --quiet; then echo "No data changes."; exit 0; fi
git commit -m "Refresh data $(date -u +%Y-%m-%dT%H:%MZ)"
git push
