---
name: cf-temp-mail-release-notify
description: Announce a cloudflare_temp_email GitHub release to the project's Telegram channel topic. Use when the user asks to notify/announce/broadcast a release to Telegram, push release notes to the channel, or send a release to the topic after running cf-temp-mail-release. Posts bilingual (中文 + English) changelog excerpts plus the release URL.
---

# Release Notify Workflow

Post an existing GitHub release's notes to the project's Telegram channel topic.

## Prerequisites

- `config.json` exists in this skill directory with `token`, `chat_id`, `message_thread_id` (gitignored, never commit).
- `gh` CLI authenticated.
- `uv` installed (`brew install uv` / `curl -LsSf https://astral.sh/uv/install.sh | sh`). Script uses PEP 723 inline metadata; `uv` auto-installs deps.

## Steps

1. **Resolve tag**: If the user didn't give one, use the latest release: `gh release list --limit 1 --json tagName --jq '.[0].tagName'`.
2. **Run the script**:
   ```bash
   uv run scripts/send_release_to_telegram.py vX.Y.Z
   ```
   The script fetches the release via `gh`, splits the body into zh/en sections, strips PR collapsibles and the cache-clearing link, truncates to fit Telegram's 4096-char limit, and posts to the configured `chat_id` + `message_thread_id`.
3. **Verify**: The script prints `ok: message_id=<id>` on success. Report the message id.

## Notes

- Message uses `parse_mode: MarkdownV2`; all content is escaped (via `md_escape`) to avoid parse errors on reserved chars `_ * [ ] ( ) ~ \` > # + - = | { } . !`.
- Only the zh/en changelog sections are posted. PRs list and the cache-clearing discussion link are stripped to keep the message concise.
- For very long release bodies, zh and en are each truncated to ~half of the 3500-char body budget.
