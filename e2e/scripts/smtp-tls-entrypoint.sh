#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="/certs"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/cert.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
  echo "==> Generating self-signed TLS certificate"
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
    -days 1 -subj "/CN=smtp-proxy-tls"
  echo "    Certificate generated"
fi

exec python3 main.py
