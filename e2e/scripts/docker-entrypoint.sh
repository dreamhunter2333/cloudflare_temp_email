#!/usr/bin/env bash
set -euo pipefail

echo "==> Waiting for worker at $WORKER_URL ..."
for i in $(seq 1 60); do
  if curl -sf "$WORKER_URL/health_check" > /dev/null 2>&1; then
    echo "    Worker ready after ${i}s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Worker not ready after 60s"
    exit 1
  fi
  sleep 1
done

echo "==> Waiting for frontend at $FRONTEND_URL ..."
for i in $(seq 1 60); do
  if curl -sf "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "    Frontend ready after ${i}s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Frontend not ready after 60s"
    exit 1
  fi
  sleep 1
done

echo "==> Initializing database"
curl -sf -X POST "$WORKER_URL/admin/db_initialize" > /dev/null
curl -sf -X POST "$WORKER_URL/admin/db_migration" > /dev/null
echo "    Database initialized"

echo "==> Running Playwright tests"
exec npx playwright test "$@"
