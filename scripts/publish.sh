#!/bin/sh
# Refresh the live site by running the Refresh data workflow on GitHub. The item store (the week's raw
# headlines) lives in that workflow's cache, so a local refresh would start from a thin or stale store.
set -e
gh workflow run refresh.yml --ref main
echo "Started the Refresh data workflow. Follow it with: gh run watch"
