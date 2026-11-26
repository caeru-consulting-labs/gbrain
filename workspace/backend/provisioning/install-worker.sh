#!/usr/bin/env bash
set -euo pipefail
backend_dir="$(cd "$(dirname "$0")/.." && pwd)"
bun_bin="$(command -v bun)"
case "$backend_dir$bun_bin" in *' '*) echo 'Paths containing spaces are not supported by this installer.' >&2; exit 1;; esac
mkdir -p "$backend_dir/.runtime"
unit="$backend_dir/.runtime/caeru-brain-worker.service"
existing="$(systemctl --user show -p FragmentPath --value caeru-brain-worker.service 2>/dev/null || true)"
if [[ -n "$existing" && "$existing" != "$unit" ]]; then echo 'A different worker service with this name is already registered.' >&2; exit 1; fi
cat > "$unit" <<UNIT
[Unit]
Description=Caeru Brain local provisioning worker
After=network-online.target docker.service
[Service]
Type=simple
WorkingDirectory=$backend_dir
ExecStart=$bun_bin $backend_dir/src/provisioning/main.ts
Restart=on-failure
RestartSec=5
[Install]
WantedBy=default.target
UNIT
systemctl --user link "$unit"
systemctl --user enable --now caeru-brain-worker.service
