#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
work_dir="$(mktemp -d /tmp/caeru-gbrain-image.XXXXXX)"
trap 'rm -rf "$work_dir"' EXIT
cd "$repo_root"
bun build --compile --bytecode --format=esm --no-compile-autoload-bunfig --outfile "$work_dir/caeru-gbrain-runtime" src/cli.ts src/core/skills/resolver/hook-worker.ts
cp workspace/backend/provisioning/Dockerfile.gbrain "$work_dir/Dockerfile"
cp workspace/backend/provisioning/gbrain-entrypoint.sh "$work_dir/gbrain-entrypoint.sh"
docker build -t caeru-gbrain-local:dev "$work_dir"
