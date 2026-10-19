#!/usr/bin/env bash
# One expanded visual audit slice, capped for shared hosts.
set -euo pipefail
cd "$(dirname "$0")/.."
theme=$1; width=$2; shift 2
exec systemd-run --user --scope -q -p MemoryMax=3G -p CPUQuota=150% \
  nice -n 19 ionice -c3 node tests/audit-ui.mjs --theme="$theme" --width="$width" "$@"
