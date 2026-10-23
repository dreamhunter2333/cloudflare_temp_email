#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../.."
repo_dir="$PWD"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/cf-wasm-e2e.XXXXXX")"
mkdir -p "$test_dir/worker" "$test_dir/e2e/wasm"
cp -R worker/src "$test_dir/worker/src"
cp worker/package.json "$test_dir/worker/"
cp -R e2e/fixtures "$test_dir/e2e/fixtures"
cp -R e2e/wasm/fixtures "$test_dir/e2e/wasm/fixtures"
ln -s "$repo_dir/worker/node_modules" "$test_dir/worker/node_modules"
ln -s "$repo_dir/e2e/node_modules" "$test_dir/e2e/node_modules"
patch -s -p1 -d "$test_dir" < .github/config/mail-parser-wasm-worker.patch
sed -e 's@main = .*@main = "../e2e/wasm/fixtures/worker.ts"@' \
    -e "s@http://worker:8787/@http://127.0.0.1:$1/@" \
    e2e/fixtures/wrangler.toml.e2e > "$test_dir/worker/wrangler.toml"
printf '\n"mail-parser-wasm-worker" = "%s/mail-parser-wasm/target/test-packages/worker/package/index.js"\n' "$repo_dir" >> "$test_dir/worker/wrangler.toml"

export WRANGLER_SEND_METRICS=false
exec worker/node_modules/.bin/wrangler dev --config "$test_dir/worker/wrangler.toml" \
    --local --ip 127.0.0.1 --port "$1" --inspector-port 0 \
    --persist-to "$test_dir/state" --var "REMOVE_ALL_ATTACHMENT:$2"
