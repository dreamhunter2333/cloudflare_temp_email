---
name: upgrade-dependencies
description: Upgrade npm dependencies across all sub-packages of the project. Use when the user asks to upgrade/update dependencies, bump deps, refresh lockfiles, or update wrangler. Runs pnpm upgrades on frontend/, worker/, pages/, and vitepress-docs/.
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

Note: `vitepress-docs/` uses `--latest` (crosses semver ranges); other packages upgrade within ranges only.

## Post-upgrade checklist

1. Inspect `git diff` on `package.json` / `pnpm-lock.yaml` files for reasonable changes.
2. Verify builds in each sub-package:
   - `cd frontend && pnpm build`
   - `cd worker && pnpm build && pnpm lint`
   - `cd vitepress-docs && pnpm build`
3. If wrangler had a major version bump, check `worker/wrangler.toml` for any required syntax changes.
4. Commit with Conventional Commits format, e.g. `chore: upgrade dependencies`.

## Do NOT

- Do not manually `pnpm add` each package instead of running the script.
- Do not run `pnpm deploy` locally — deployments go through GitHub Actions.
- Do not update CHANGELOG for routine dep bumps unless the user explicitly requests it.
