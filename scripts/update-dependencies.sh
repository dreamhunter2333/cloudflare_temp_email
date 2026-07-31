set -euo pipefail

cd frontend/
pnpm up
pnpm add -D wrangler@latest
cd ..

cd worker/
pnpm up
pnpm add -D wrangler@latest
cd ..

cd pages/
pnpm up
pnpm add -D wrangler@latest
cd ..

cd vitepress-docs/
pnpm up --latest
pnpm add -D wrangler@latest
cd ..

cd e2e/ || exit 1
npx --yes npm-check-updates@23.0.0 --upgrade
npm install

PLAYWRIGHT_VERSION="$(node -p "require('./package.json').devDependencies['@playwright/test']")"
EXPECTED_IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"
if ! awk -v expected="${EXPECTED_IMAGE}" \
  '$1 == "FROM" && $2 == expected { found=1 } END { exit !found }' \
  Dockerfile.e2e; then
  echo "Dockerfile.e2e must use Playwright ${PLAYWRIGHT_VERSION}" >&2
  exit 1
fi

cd ..
