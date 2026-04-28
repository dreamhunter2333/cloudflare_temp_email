# FAQ

> [!NOTE] Note
> If you don't find a solution here, please search or ask in `Github Issues`, or ask in the Telegram group.

## General

| Issue                                                  | Solution                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Sending emails to authenticated forwarding addresses using Cloudflare Workers | Use CF's API for sending, only supports recipient addresses bound to CF, i.e., CF EMAIL forwarding destination addresses |
| Binding multiple domains                               | Each domain needs to configure email forwarding to worker                                         |
| Subdomain cannot receive email                         | Subdomains must have Email Routing **enabled separately** on Cloudflare with their own DNS records and Catch-all rule. Enabling it only on the apex domain does NOT cover subdomains. See [Email Routing](/en/guide/email-routing) |
| Recreating a previously used mailbox shows that the address already exists | The address may have been recreated or bound by another user after it expired or was unbound, so a normal user cannot reclaim it directly. If you have admin access, find the address in the admin address list, get its address credential, and then bind it to the target user again |

## Worker Related

| Issue                                                              | Solution                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Uncaught Error: No such module "path". imported from "worker.js"` | [Reference](/en/guide/ui/worker)                                            |
| `No such module "node:stream". imported from "worker.js"`          | [Reference](/en/guide/ui/worker)                                            |
| `Subdomain cannot send emails`                                     | [Reference](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/515) |
| `Failed to send verify code: No balance`                           | Set unlimited emails in admin console or increase quota on the sending permission page |
| `GitHub OAuth unable to get email` / `[400]: Failed to get user email from OAuth2 provider` | The GitHub template reads the `email` field from `https://api.github.com/user`. If the GitHub account hides its public email, this field is `null`. Make the email public in the GitHub profile, or use an OAuth2 provider/API that returns an email field |
| `Cannot read properties of undefined (reading 'map')` during page initialization | First check whether `/open_api/settings` is returning valid data. In a direct Worker deployment, this usually means Worker variables were not configured correctly, so verify JSON-format variables such as `DOMAINS` and `ADMIN_PASSWORDS`. If this happens in a Pages deployment because requests are going to the wrong backend address, continue with the Pages troubleshooting section below |
| Worker backend opens as `OK`, but every frontend request shows `Network Error` | First open the frontend in an incognito window to rule out a cached old frontend bundle. Then make sure Cloudflare security modes such as Under Attack, Bot Fight, or Managed Challenge are not applied to the API domain; those browser challenges block XHR/API requests and surface as `Network Error` |
| Mail suddenly stops arriving, deleting a few mails makes it work again, and Worker logs show `D1_ERROR: Exceeded maximum DB size` | The D1 database has reached its per-database size limit and can no longer write `raw_mails`. Delete old mails, enable auto cleanup in the admin console, and make sure the Worker has a `Settings -> Trigger Events -> Cron Triggers` schedule; otherwise admin cleanup settings will not run automatically |

## Pages Related

| Issue           | Solution                                                  |
| --------------- | --------------------------------------------------------- |
| `Network Error` | First use incognito mode or clear browser cache and DNS cache; then inspect the failed request URL, status code, and response body in the browser DevTools Network panel |
| Pages deployment shows the `map` error, or API requests such as `/admin/users` / `/admin/new_address` return `405 Method Not Allowed` | This is usually caused by an incorrect frontend backend address. Check `VITE_API_BASE`, the URL entered when generating the zip in the UI guide, or `FRONTEND_ENV`: for separate frontend/backend deployment talking directly to Worker, it should be the backend Worker API root URL, start with `https://`, and have no trailing `/`; if you use `PAGE_TOML` to proxy backend requests through Page Functions, `VITE_API_BASE` can be left empty to use same-origin requests. See [Pages Frontend Deployment](/en/guide/ui/pages) |
| Refreshing page or directly visiting `/admin`, `/user` returns 404 | This project is a Single-Page Application (SPA). When deploying Pages via UI, set "Not Found handling" to `Single-page application (SPA)` in the advanced options. See [Pages Frontend Deployment](/en/guide/ui/pages) |
| Admin login shows `Network Error` and the request is `/open_api/admin_login` | Check that the backend API root URL used when generating the frontend zip is the Worker domain, not the Pages domain; it must not include `/admin`, `/api`, or a trailing `/`. Also confirm the response is not a Cloudflare security challenge page |

## Email Sending Related

| Issue           | Solution                                                  |
| --------------- | --------------------------------------------------------- |
| Set `DEFAULT_SEND_BALANCE` but still getting `No balance` | Refresh the settings page or try sending again first. When `DEFAULT_SEND_BALANCE > 0`, the system only auto-initializes the default quota for addresses that have **no `address_sender` row yet**; existing rows — including legacy `balance = 0 && enabled = 0` rows, admin-disabled rows, and admin-edited rows — are never modified by the runtime and must be manually restored by an admin (enable + set balance). Alternatively, add the address to the "No Limit Send Address List" in the admin console, or configure `NO_LIMIT_SEND_ROLE` |
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
| Use GitHub Actions auto-update while forwarding backend requests through Page Functions | Enable the `Deploy Frontend with page function` workflow and configure the `PAGE_TOML` secret. Copy `pages/wrangler.toml` into `PAGE_TOML`, then change `service` to your Worker backend name. This workflow uses same-origin requests and does not need `FRONTEND_ENV` |
