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
if ! grep -Fq "playwright:v${PLAYWRIGHT_VERSION}-noble" Dockerfile.e2e; then
  echo "Dockerfile.e2e must use Playwright ${PLAYWRIGHT_VERSION}" >&2
  exit 1
fi

cd ..
