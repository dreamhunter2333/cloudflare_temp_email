# E2E Tests

End-to-end tests for Cloudflare Temp Email using [Playwright](https://playwright.dev/) and [Mailpit](https://mailpit.axllent.org/), fully containerized with Docker Compose.

## Prerequisites

- **Docker** and **Docker Compose 2.20+** (optional profile dependencies)

## Quick Start

```bash
cd e2e

# Build, start all services, run tests, and exit
npm test

# Clean up containers and volumes
npm run test:down
```

`npm test` enables all Compose profiles and runs `docker compose up --build`, which:
1. Starts **Mailpit** (SMTP on :1025, HTTP API on :8025)
2. Builds and starts the **Worker** (wrangler dev on :8787)
3. Builds and starts the **Frontend** (vite dev on :5173)
4. Builds and runs the **E2E runner** (Playwright), which waits for services, initializes the DB, and runs all tests

The exit code reflects the test result.

GitHub Actions runs API, browser, Webhook UI and SMTP/IMAP groups on separate runners, each with its own Compose stack and report. The Webhook group contains the 34 Webhook browser tests; the other 70 browser tests remain in one browser job. API-side Webhook coverage stays in the API group. Tests inside each runner remain serial. Compose profiles start only the services needed by each group:

| Profile | Services, excluding the test runner |
| --- | --- |
| `api` | Mailpit and all six Worker variants; no frontend or SMTP/IMAP proxies |
| `browser` | Mailpit, default/env-off Workers and their two frontends |
| `webhook` | Mailpit, default Worker and its frontend |
| `smtp-proxy` | Mailpit, default Worker and plain/TLS SMTP/IMAP proxies |

Unit tests run once in a separate Node.js job. The `e2e` check requires every group and unit test job to succeed.

Local `npm test` still runs all Compose-backed suites and unit tests by default. To run one suite with only its services, use the matching profile and project, for example:

```bash
COMPOSE_PROFILES=api PLAYWRIGHT_PROJECT=api docker compose up --build --abort-on-container-exit --exit-code-from e2e-runner
```

CI uses `RUN_UNIT_TESTS=false` in Compose because its separate unit job already runs those tests. `npm run test:down` cleans up services from all profiles.

## Test Structure

| Project | Directory | What it tests |
|---------|-----------|---------------|
| `api` | `api/tests/` | Worker APIs, including gzip storage, authentication, mail, Webhook and cleanup |
| `browser` | `browser/tests/` | Frontend UI in Chromium |
| `webhook` | `webhook/tests/` | Webhook UI: filter editor, presets and test dialogs in Chromium |
| `smtp-proxy` | `smtp-proxy/tests/` | SMTP/IMAP proxy, including TLS |
| WASM | `wasm/tests/` | Both packaged parsers in Node.js and Workers, run by the separate WASM CI workflow |
| Unit | `unit/tests/` | Node.js unit tests, without Docker or a browser |

Shared Worker fixtures, mail helpers and TOML configurations stay in `fixtures/`. WASM-only configuration, fixtures and build/start scripts live together in `wasm/`; shared container entrypoints stay in `scripts/`.

```bash
# Node.js 24+, from e2e/
npm ci
npm run test:unit

# Build and test both WASM npm packages (Rust, wasm-pack and Worker dependencies required)
bash wasm/scripts/build.sh
NODE_OPTIONS=--experimental-wasm-modules npx playwright test --config wasm/playwright.config.ts
```

WASM CI builds and tests packages without Docker or Chromium. Publishing remains tag-only via `mail-parser-wasm-v*`; ordinary E2E runs do not publish packages.

## Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| Mailpit SMTP | `mailpit` | 1025 | Captures outgoing emails |
| Mailpit HTTP | `mailpit` | 8025 | API to verify captured emails |
| Worker | `worker` | 8787 | Backend API with E2E config |
| Frontend | `frontend` | 5173 | Vue frontend dev server |

## Test Results

Test results and HTML reports are exported via volumes:
- `e2e/test-results/` — test artifacts
- `e2e/playwright-report/` — HTML report

## Configuration

The E2E worker uses `fixtures/wrangler.toml.e2e` with:
- `DISABLE_ADMIN_PASSWORD_CHECK = true` — allows unauthenticated admin calls
- `DEFAULT_SEND_BALANCE = 10` — allows sending without admin approval
- SMTP pointed at Mailpit container (`mailpit:1025`)

Test-only endpoints under `/__test/*` are registered in `e2e/fixtures/worker.ts` and are excluded from the production Worker.
