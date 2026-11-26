#!/usr/bin/env bash
# DESTRUCTIVE fixture setup runs only against the container created by this script.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v docker >/dev/null
command -v bun >/dev/null
name="caeru-poc-${RANDOM}-${RANDOM}"
container_id=''
cleanup() { if [[ -n "$container_id" ]]; then docker rm -f "$container_id" >/dev/null; fi; }
trap cleanup EXIT
container_id=$(docker run -d --rm --name "$name" -p 127.0.0.1::5432 -e POSTGRES_USER=gbrain_test -e POSTGRES_PASSWORD=poc_only -e POSTGRES_DB=gbrain_test pgvector/pgvector:pg16)
ready=0
for i in {1..60}; do if docker exec "$container_id" pg_isready -h 127.0.0.1 -U gbrain_test -d gbrain_test >/dev/null 2>&1; then ready=1; break; fi; sleep 1; done
[[ "$ready" == 1 ]] || { echo 'Disposable PostgreSQL failed to become ready' >&2; exit 1; }
port=$(docker port "$container_id" 5432/tcp | sed -n 's/^127\.0\.0\.1://p')
[[ "$port" =~ ^[0-9]+$ ]] || { echo 'Could not identify disposable container port' >&2; exit 1; }
export DATABASE_URL="postgresql://gbrain_test:poc_only@127.0.0.1:${port}/gbrain_test"
export GBRAIN_DATABASE_URL="$DATABASE_URL" GBRAIN_TEST_ALLOW_DATABASE_URL=1 GBRAIN_CI_DISABLE_TEST_ENV_FILE=1 CAERU_DISPOSABLE_POC=1
bun --no-env-file test workspace/poc/isolation.test.ts
bun --no-env-file test test/e2e/engine-sql-rls-scope.test.ts
bun --no-env-file test test/e2e/jobs-agent-scope-postgres.test.ts
bun --no-env-file test --timeout 120000 test/e2e/facts-cross-source-isolation.test.ts
