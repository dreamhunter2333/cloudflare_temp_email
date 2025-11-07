# Quick Start

## Before You Begin

You need a `good network environment` and a `Cloudflare account`. Open the [Cloudflare Dashboard](https://dash.cloudflare.com/)

Please choose one of the three deployment methods below:

- [Deploy via Command Line](/en/guide/cli/pre-requisite)
- [Deploy via User Interface](/en/guide/ui/d1)
- [Deploy via Github Actions](/en/guide/actions/pre-requisite)

### You can also refer to detailed tutorials provided by the community

- [【Tutorial】Beginner-Friendly Guide to Building Your Own Cloudflare Temporary Email (Domain Email)](https://linux.do/t/topic/316819/1)

## Upgrade Process

First, confirm your current version, then visit the [Release page](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/) and [CHANGELOG page](https://github.com/dreamhunter2333/cloudflare_temp_email/blob/main/CHANGELOG.md) to find your current version.

> [!WARNING] Warning
> Pay attention to `Breaking Changes` which require `database SQL execution` or `configuration changes`.

Then review all changes from your current version onwards. Note that `Breaking Changes` require `database SQL execution` or `configuration changes`, while other feature updates can be configured as needed.

Then refer to the documentation below to use `CLI` or `UI` to redeploy the `worker` and `pages` over the previous deployment.

### CLI Deployment

- [Update D1 via Command Line](/en/guide/cli/d1)
- [Deploy Worker via Command Line](/en/guide/cli/worker)
- [Deploy Pages via Command Line](/en/guide/cli/pages)

### UI Deployment

- [Update D1 via User Interface](/en/guide/ui/d1)
- [Deploy Worker via User Interface](/en/guide/ui/worker)
- [Deploy Pages via User Interface](/en/guide/ui/pages)

### Github Actions Deployment

- [How to Configure Auto-Update with Github Actions](/en/guide/actions/auto-update)
