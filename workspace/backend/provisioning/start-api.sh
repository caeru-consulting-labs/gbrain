#!/usr/bin/env bash
set -euo pipefail
# The privileged worker alone should hold Docker group access.
if command -v setpriv >/dev/null 2>&1; then
  exec setpriv --no-new-privs --clear-groups bun --watch src/main.ts
fi
if [ -w /var/run/docker.sock ]; then
  echo 'Cannot safely start API with Docker socket access; run it without the socket or Docker privileges.' >&2
  exit 1
fi
exec bun --watch src/main.ts
