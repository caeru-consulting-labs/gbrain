#!/bin/sh
set -eu
umask 077
if [ ! -f "$GBRAIN_HOME/.gbrain/config.json" ]; then
  gbrain init --db-only --url "$DATABASE_URL" --no-embedding --non-interactive > "$GBRAIN_HOME/init.log" 2>&1
fi
exec gbrain serve --http --bind 0.0.0.0 --port 3131 --suppress-bootstrap-token
