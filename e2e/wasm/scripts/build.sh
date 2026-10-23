#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../../mail-parser-wasm"
cargo test
wasm-pack build --release
wasm-pack build --out-dir web --target web --release
find web/ -type f ! -name '*.json' ! -name '.gitignore' -exec cp {} worker/ \;

mkdir -p target/test-packages/browser target/test-packages/worker
package_version="$(node -p "require('./pkg/package.json').version")"
npm pack ./pkg --pack-destination target/test-packages
npm pack ./worker --pack-destination target/test-packages
tar -xzf "target/test-packages/mail-parser-wasm-$package_version.tgz" -C target/test-packages/browser
tar -xzf "target/test-packages/mail-parser-wasm-worker-$package_version.tgz" -C target/test-packages/worker
