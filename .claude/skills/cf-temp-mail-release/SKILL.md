---
name: cf-temp-mail-release
description: Create a GitHub release for cloudflare_temp_email project. Use when the user asks to create a release, publish a version, tag a release, or make a new release. Reads CHANGELOG.md for release content, collects merged PRs via `gh` CLI, and creates a properly formatted GitHub release.
---

# Release Workflow

## Steps

1. **Read version**: Get current version from `worker/package.json` (`"version"` field) and the latest release tag via `gh release list --limit 1`.
2. **Read CHANGELOG**: Read `CHANGELOG.md` for the current version section (e.g. `## v1.4.0(main)`). Verify content matches `CHANGELOG_EN.md`. If entries are missing from either file, notify the user.
3. **Collect PRs**: Get the last release tag timestamp, then filter merged PRs by time:
   ```bash
   TAG="$(gh release list --limit 1 --json tagName --jq '.[0].tagName')"
   SINCE="$(git show -s --format=%cI "$TAG")"
   gh pr list --state merged --search "is:pr is:merged merged:>$SINCE base:main" --json number,title,author --limit 200
   ```
   Sort by PR number ascending.
4. **Check database upgrades**: Compare the previous release tag with the exact release target, including `db/` migrations, `db/schema.sql`, and the Admin database-update implementation. Use `git diff <previous-tag> <target> -- db/` (fetch missing refs first), not PR timestamps alone. Read each changed migration to determine required upgrade steps and effects on existing data. Only recommend the Admin database-update button after verifying it applies these migrations. Do not execute database changes as part of release preparation.
5. **Compose release body**: Follow the template in [references/release-template.md](references/release-template.md). Key rules:
   - Write release body in **bilingual format**: Chinese sections first (from `CHANGELOG.md`), then wrap the English sections (from `CHANGELOG_EN.md`) in `<details><summary>English</summary>...</details>`.
   - Copy changelog sections verbatim from both files. Omit empty sections.
   - When database changes exist, add a standalone `### 数据库变更` section before Features and a matching `### Database Changes` section at the start of the English details. Keep this separate from Breaking Changes: an additive or optional migration is not inherently a breaking change.
   - State which feature requires each migration. Verify the feature's disabled code paths before saying it is optional: if the feature is not used and existing functionality does not depend on the migration, explicitly say users can skip it unless they enable that feature later. Distinguish these optional migrations from migrations required for normal operation; do not describe every migration as mandatory for all deployments.
   - List the changed tables/columns/indexes, release-tag-pinned migration links in execution order, and the actions required for existing deployments versus fresh installations. Explain whether existing data is preserved, rewritten, or deleted based on the SQL; do not infer data loss from a schema change. Warn against reapplying non-idempotent migrations such as `ADD COLUMN`; recommend a backup before migration. If the upgrade path is unclear, resolve it before publishing rather than inventing commands. Do not add an empty database warning when no upgrade is needed.
   - Wrap PRs list in `<details><summary>PRs</summary>...</details>`.
   - Always include the cache-clearing discussion link.
   - End with `**Full Changelog**` comparison link.
6. **Create release**:
   - Write body to a temp file (e.g. `/tmp/release-notes.md`)
   - Run: `gh release create vX.Y.Z --title "vX.Y.Z" --notes-file /tmp/release-notes.md --target main`
7. **Verify**: Read back the published body, verify all required migration links and bilingual upgrade instructions are present, then confirm the release URL and ask the user to review.
