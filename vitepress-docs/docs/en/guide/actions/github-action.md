# Deploy via GitHub Actions

::: warning Notice
Currently only supports Worker and Pages deployment.
If you encounter any issues, please report them via `GitHub Issues`. Thank you.

The `worker.dev` domain is inaccessible in China, please use a custom domain
:::

## Deployment Steps

### Fork Repository and Enable Actions

- Fork this repository on GitHub
- Open the `Actions` page of the repository
- Find `Deploy Backend` and click `enable workflow` to enable the `workflow`
- If you need separate frontend and backend deployment, find `Deploy Frontend` and click `enable workflow` to enable the `workflow`

### Configure Secrets

Then go to the repository page `Settings` -> `Secrets and variables` -> `Actions` -> `Repository secrets`, and add the following `secrets`:

- Common `secrets`

   | Name                    | Description                                                                                                            |
   | ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
   | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID, [Reference Documentation](https://developers.cloudflare.com/workers/wrangler/ci-cd/#cloudflare-account-id) |
   | `CLOUDFLARE_API_TOKEN`  | Cloudflare API Token, [Reference Documentation](https://developers.cloudflare.com/workers/wrangler/ci-cd/#api-token)           |

- Worker backend `secrets`

   | Name                           | Description                                                                                                                                    |
   | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
   | `BACKEND_TOML`                 | Backend configuration file, [see here](/en/guide/cli/worker.html#modify-wrangler-toml-configuration-file)                                      |
   | `DEBUG_MODE`                   | (Optional) Whether to enable debug mode, set to `true` to enable. By default, worker deployment logs are not output to GitHub Actions page, enabling this will output them |
   | `BACKEND_USE_MAIL_WASM_PARSER` | (Optional) Whether to use WASM to parse emails, set to `true` to enable. For features, refer to [Configure Worker to use WASM Email Parser](/en/guide/feature/mail_parser_wasm_worker) |
   | `USE_WORKER_ASSETS`            | (Optional) Deploy Worker with frontend assets, set to `true` to enable                                                                         |

- Pages frontend `secrets`

   > [!warning] Notice
   > If you choose to deploy Worker with frontend assets, these `secrets` are not required

   | Name               | Description                                                                                                                                                                      |
   | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `FRONTEND_ENV`     | Frontend configuration file, please copy the content from `frontend/.env.example`, [and modify according to this guide](/en/guide/cli/pages.html)                               |
   | `FRONTEND_NAME`    | The project name you created in Cloudflare Pages, can be created via [UI](https://temp-mail-docs.awsl.uk/en/guide/ui/pages.html) or [Command Line](https://temp-mail-docs.awsl.uk/en/guide/cli/pages.html) |
   | `FRONTEND_BRANCH`  | (Optional) Branch for pages deployment, can be left unconfigured, defaults to `production`                                                                                      |
   | `PAGE_TOML`        | (Optional) Required when using page functions to forward backend requests. Please copy the content from `pages/wrangler.toml` and modify the `service` field to your worker backend name according to actual situation |
   | `TG_FRONTEND_NAME` | (Optional) The project name you created in Cloudflare Pages, same as `FRONTEND_NAME`. Fill this in if you need Telegram Mini App functionality                                  |

### Deploy

- Open the `Actions` page of the repository
- Find `Deploy Backend` and click `Run workflow` to select a branch and deploy manually
- If you need separate frontend and backend deployment, find `Deploy Frontend` and click `Run workflow` to select a branch and deploy manually

## How to Configure Auto-Update

1. Open the `Actions` page of the repository, find `Upstream Sync`, and click `enable workflow` to enable the `workflow`
2. If `Upstream Sync` fails, go to the repository homepage and click `Sync` to synchronize manually
