# Repository Guidelines

## Project Structure
- Backend: `worker/` (Workers API; entry `worker/src/worker.ts`, APIs under `worker/src/*_api/`).
- Frontend: `frontend/` (Vue 3 app; routes in `frontend/src/router/`).
- Pages middleware: `pages/functions/_middleware.js`.
- Mail parser: `mail-parser-wasm/` (Rust WASM).
- SMTP/IMAP proxy: `smtp_proxy_server/`.
- DB schema/migrations: `db/`.
- Docs: `vitepress-docs/`.

## Build & Dev Commands
Run inside each folder:
- Frontend: `pnpm dev`, `pnpm build`.
- Worker: `pnpm dev`, `pnpm lint`, `pnpm build`.
- Pages: `pnpm dev`.
- Docs: `pnpm dev` in `vitepress-docs/`.
- WASM: `wasm-pack build --release` in `mail-parser-wasm/`.
- SMTP proxy: `pip install -r smtp_proxy_server/requirements.txt` then `python smtp_proxy_server/main.py`.

## Coding Style
- Follow existing module style. `worker/` uses TypeScript + ESLint; `frontend/` uses Vue SFCs.
- Keep current naming patterns: `*_api/`, `utils/`, `models/`.
- ESM imports only (`type: module`).

## Testing
- No formal test runner. Validate with local dev servers and key flows (login, inbox, send/receive).

## Commits & PRs
- Use Conventional Commits (`feat:`, `fix:`, `docs:`). Recent history includes PR numbers like `(#123)`.
- PRs should explain scope and add screenshots for UI changes.

## Config Tips
- Worker settings in `worker/wrangler.toml` (see template for bindings).
- Frontend uses `VITE_*` env vars. Don’t commit secrets.
