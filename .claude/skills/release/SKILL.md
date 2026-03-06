---
name: release
description: Create a GitHub release for cloudflare_temp_email project. Use when the user asks to create a release, publish a version, tag a release, or make a new release. Reads CHANGELOG.md for release content, collects merged PRs via `gh` CLI, and creates a properly formatted GitHub release.
---

# Release Workflow

## Steps

1. **Read version**: Get current version from `worker/package.json` (`"version"` field) and the latest release tag via `gh release list --limit 1`.
2. **Read CHANGELOG**: Read `CHANGELOG.md` for the current version section (e.g. `## v1.4.0(main)`). Verify content matches `CHANGELOG_EN.md`. If entries are missing from either file, notify the user.
3. **Collect PRs**: Run `gh pr list --state merged --base main` filtered to PRs since the last release tag. Sort by PR number ascending.
4. **Compose release body**: Follow the template in [references/release-template.md](references/release-template.md). Key rules:
   - Copy changelog sections verbatim (Features, Bug Fixes, Testing, Improvements). Omit empty sections.
   - Wrap PRs list in `<details><summary>PRs</summary>...</details>`.
   - Always include the cache clearing discussion link.
   - End with `**Full Changelog**` comparison link.
5. **Create release**:
   - Write body to a temp file (e.g. `/tmp/release-notes.md`)
   - Run: `gh release create vX.Y.Z --title "vX.Y.Z" --notes-file /tmp/release-notes.md --target main`
6. **Verify**: Confirm the release URL and ask the user to review.
