#!/usr/bin/env bash
# Deploy the built skin into a Roundcube install: rsync skin/ → <roundcube>/skins/gmail/
# Usage: RC=/path/to/roundcube npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."
: "${RC:?Set RC to the intended Roundcube installation directory}"
[ -d "$RC/config" ] && [ -d "$RC/skins" ] || { echo 'deploy: RC must contain config/ and skins/' >&2; exit 1; }
DEST="$RC/skins/gmail"
for f in skin/styles/styles.min.css skin/styles/print.min.css skin/styles/embed.min.css skin/ui.min.js skin/meta.json; do
  [ -s "$f" ] || { echo "deploy: missing $f — run 'npm run build' first" >&2; exit 1; }
done
mkdir -p "$DEST"
rsync -a --delete --exclude '.git*' --exclude '*.map' skin/ "$DEST/"
echo "deploy: skin → $DEST ($(du -sh "$DEST" | cut -f1))"
