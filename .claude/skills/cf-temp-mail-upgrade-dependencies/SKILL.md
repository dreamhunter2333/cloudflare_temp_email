---
name: cf-temp-mail-upgrade-dependencies
description: Upgrade npm dependencies across all sub-packages of the project. Use when the user asks to upgrade/update dependencies, bump deps, refresh lockfiles, or update wrangler. Runs pnpm upgrades on frontend/, worker/, pages/, and vitepress-docs/, plus npm upgrades on e2e/.
---

# Upgrade Dependencies

Upgrade npm dependencies for the cloudflare_temp_email sub-packages.

## How to run

Execute the project-root script:

```bash
bash scripts/update-dependencies.sh
```

The script runs the following in order:

| Directory | Commands |
|-----------|----------|
| `frontend/` | `pnpm up` + `pnpm add -D wrangler@latest` |
| `worker/` | `pnpm up` + `pnpm add -D wrangler@latest` |
| `pages/` | `pnpm up` + `pnpm add -D wrangler@latest` |
| `vitepress-docs/` | `pnpm up --latest` + `pnpm add -D wrangler@latest` |
| `e2e/` | `npx --yes npm-check-updates@23.0.0 --upgrade` + `npm install` + Playwright image validation |

Note: `vitepress-docs/` and `e2e/` upgrade to the latest versions and may cross semver ranges; other packages upgrade within ranges only. `e2e/` uses npm because it has a `package-lock.json`.

## Post-upgrade checklist

1. Inspect `git diff` on `package.json`, `pnpm-lock.yaml`, and `package-lock.json` files for reasonable changes.
2. Verify builds in each sub-package:
   - `cd frontend && pnpm build`
   - `cd worker && pnpm build && pnpm lint`
   - `cd vitepress-docs && pnpm build`
   - `cd e2e && npm test`
3. If Playwright changed, keep `e2e/Dockerfile.e2e` on the matching Playwright image version.
4. If wrangler had a major version bump, check `worker/wrangler.toml` for any required syntax changes.
5. Commit with Conventional Commits format, e.g. `chore: upgrade dependencies`.

## Do NOT

- Do not manually `pnpm add` each package instead of running the script.
- Do not run `pnpm deploy` locally — deployments go through GitHub Actions.
- Do not update CHANGELOG for routine dep bumps unless the user explicitly requests it.
