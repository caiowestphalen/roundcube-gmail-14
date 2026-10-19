#!/usr/bin/env bash
# Run the remaining sweep slices one after another, each capped (see sweep-slice.sh), after any
# running sweep has finished. Usage: nohup tools/sweep-queue.sh [deploy] "light 390" "dark 390" &
set -u
cd "$(dirname "$0")/.."
while pgrep -f "[n]ode tests/sweep" >/dev/null; do sleep 10; done
if [ "${1:-}" = "deploy" ]; then
  bash tools/deploy.sh | tail -1
  shift
fi
for slice in "$@"; do
  set -- $slice
  tools/sweep-slice.sh "$1" "$2" > "test-results/sweep-$1-$2.log" 2>&1
  echo "$1/$2 done: $(tail -1 "test-results/sweep-$1-$2.log")"
done
echo QUEUE_DONE
