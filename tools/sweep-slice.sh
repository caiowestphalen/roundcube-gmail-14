#!/usr/bin/env bash
# Run one sweep slice with CPU/memory caps and low priority on shared hosts. Usage: tools/sweep-slice.sh <theme> <width> [extra args]
set -euo pipefail
cd "$(dirname "$0")/.."
theme=$1; width=$2; shift 2
exec systemd-run --user --scope -q -p MemoryMax=3G -p CPUQuota=200% \
  nice -n 19 ionice -c3 node tests/sweep.mjs --themes="$theme" --widths="$width" "$@"
