# FAQ

> [!NOTE] Note
> If you don't find a solution here, please search or ask in `Github Issues`, or ask in the Telegram group.

## General

| Issue                                                  | Solution                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Sending emails to authenticated forwarding addresses using Cloudflare Workers | Use CF's API for sending, only supports recipient addresses bound to CF, i.e., CF EMAIL forwarding destination addresses |
| Binding multiple domains                               | Each domain needs to configure email forwarding to worker                                         |

## Worker Related

| Issue                                                              | Solution                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Uncaught Error: No such module "path". imported from "worker.js"` | [Reference](/en/guide/ui/worker)                                            |
| `No such module "node:stream". imported from "worker.js"`          | [Reference](/en/guide/ui/worker)                                            |
| `Subdomain cannot send emails`                                     | [Reference](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/515) |
| `Failed to send verify code: No balance`                           | Set unlimited emails in admin console or increase quota on the sending permission page |
| `Github OAuth unable to get email 400 Failed to get user email`    | GitHub user needs to set email to public                                    |
| `Cannot read properties of undefined (reading 'map')`              | Worker variables not set successfully. Check that JSON-format variables like `DOMAINS` and `ADMIN_PASSWORDS` are configured correctly |

## Pages Related

| Issue           | Solution                                                  |
| --------------- | --------------------------------------------------------- |
| `network error` | Use incognito mode or clear browser cache and DNS cache   |
| Refreshing page or directly visiting `/admin`, `/user` returns 404 | This project is a Single-Page Application (SPA). When deploying Pages via UI, set "Not Found handling" to `Single-page application (SPA)` in the advanced options. See [Pages Frontend Deployment](/en/guide/ui/pages) |

## Email Sending Related

| Issue           | Solution                                                  |
| --------------- | --------------------------------------------------------- |
| Set `DEFAULT_SEND_BALANCE` but still getting `No balance` | `DEFAULT_SEND_BALANCE` is the default quota when users **request sending permission**. Users must first click "Request Send Permission" in the frontend. Alternatively, add the address to the "No Limit Send Address List" in the admin console, or configure `NO_LIMIT_SEND_ROLE` |
| Error: `Please enable resend or smtp for this domain` | You need to configure `RESEND_TOKEN` or `SMTP_CONFIG` first. See [Configure Email Sending](/en/guide/config-send-mail) |
| `SMTP_CONFIG` configured but sending fails | Make sure the JSON key is **your own sending domain** (e.g. `your-domain.com`), not the example `awsl.uk`. See [Configure Email Sending](/en/guide/config-send-mail#send-emails-using-smtp) |

## Mail Client Related

| Issue           | Solution                                                  |
| --------------- | --------------------------------------------------------- |
| Set `ENABLE_ADDRESS_PASSWORD` but Foxmail/Outlook cannot login | `ENABLE_ADDRESS_PASSWORD` only enables the "address password login" web API. It does **NOT** provide standard IMAP/SMTP service. To use mail clients, you need to deploy the [SMTP/IMAP Proxy Service](/en/guide/feature/config-smtp-proxy) |

## Telegram Bot

| Issue                                                                      | Solution                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `Telgram Bot failed to get email: 400: Bad Request:BUTTON_URL_INVALID`    | tg mini app URL is incorrect, should be the pages URL          |
| `Telegram bot bind error: bind adress count reach the limit`               | Need to set worker variable `TG_MAX_ADDRESS`                   |

## Github Actions

| Issue                                                      | Solution                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| After Github Action deployment, CF always shows preview branch | Go to CF pages settings to confirm that the frontend branch matches the Github Action frontend deployment branch |
