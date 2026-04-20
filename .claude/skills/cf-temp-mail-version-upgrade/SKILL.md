---
name: cf-temp-mail-version-upgrade
description: Upgrade the project version number. Use when the user asks to bump the version, upgrade the version, or prepare a new release version. Supports major, minor, and patch upgrades.
---

# Version Upgrade

Upgrade the version number of the cloudflare_temp_email project.

## Files to modify

1. `frontend/package.json` — `version` field
2. `worker/package.json` — `version` field
3. `worker/src/constants.ts` — `VERSION` constant (format: `VERSION: 'v' + '1.4.0'`)
4. `pages/package.json` — `version` field
5. `vitepress-docs/package.json` — `version` field
6. `CHANGELOG.md` — add new version placeholder
7. `CHANGELOG_EN.md` — add new version placeholder (English)

## Upgrade workflow

1. Read `frontend/package.json` to get the current version.
2. Compute the new version based on the upgrade type:
   - major: 1.3.0 → 2.0.0
   - minor: 1.3.0 → 1.4.0
   - patch: 1.3.0 → 1.3.1
3. Update the `version` field in every `package.json` listed above.
4. Update the `VERSION` constant in `worker/src/constants.ts`.
5. Insert a new version placeholder at the top of `CHANGELOG.md`.
6. Insert a new version placeholder at the top of `CHANGELOG_EN.md`.

## CHANGELOG format

In `CHANGELOG.md`, insert before the existing `## v{OLD_VERSION}(main)` line (i.e. right after the closing `</p>` of the language-switch link):

```markdown
## v{VERSION}(main)

### Features

### Bug Fixes

### Improvements

```

`CHANGELOG_EN.md` uses the same format.

## Commit message format

```
feat: upgrade version to v{VERSION}

- Update version number to {VERSION} in all package.json files
- Add v{VERSION} placeholder in CHANGELOG.md
```
