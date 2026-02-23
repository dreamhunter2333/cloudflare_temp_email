# Common Issues

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
| `Cannot read properties of undefined (reading 'map')`              | Worker variables not set successfully                                       |

## Pages Related

| Issue           | Solution                                                  |
| --------------- | --------------------------------------------------------- |
| `network error` | Use incognito mode or clear browser cache and DNS cache   |

## Telegram Bot

| Issue                                                                      | Solution                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `Telgram Bot failed to get email: 400: Bad Request:BUTTON_URL_INVALID`    | tg mini app URL is incorrect, should be the pages URL          |
| `Telegram bot bind error: bind adress count reach the limit`               | Need to set worker variable `TG_MAX_ADDRESS`                   |

## Github Actions

| Issue                                                      | Solution                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| After Github Action deployment, CF always shows preview branch | Go to CF pages settings to confirm that the frontend branch matches the Github Action frontend deployment branch |
