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
  if curl -skf "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "    Frontend ready after ${i}s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Frontend not ready after 60s"
    exit 1
  fi
  sleep 1
done

echo "==> Waiting for smtp-proxy-tls SMTP on $SMTP_PROXY_TLS_HOST:$SMTP_PROXY_TLS_SMTP_PORT ..."
for i in $(seq 1 30); do
  if nc -z "$SMTP_PROXY_TLS_HOST" "$SMTP_PROXY_TLS_SMTP_PORT" 2>/dev/null; then
    echo "    smtp-proxy-tls SMTP ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "WARNING: smtp-proxy-tls SMTP not ready after 30s, continuing anyway"
  fi
  sleep 1
done

echo "==> Initializing database"
curl -sf -X POST "$WORKER_URL/admin/db_initialize" > /dev/null
curl -sf -X POST "$WORKER_URL/admin/db_migration" > /dev/null
echo "    Database initialized"

echo "==> Running Playwright tests"
exec npx playwright test "$@"
