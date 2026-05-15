# Configure Subdomain Email

::: warning Note
Subdomain emails may not be able to send emails. It is recommended to use main domain emails for sending and subdomain emails only for receiving.

Mail channel is no longer supported. The reference below is limited to the receiving part only.
:::

Reference

- [Configure Subdomain Email](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/164#issuecomment-2082612710)

## Create Random Second-level Subdomain Addresses

If your base domain mail routing is already configured, you can also let users create mailbox
addresses with an automatically generated random second-level subdomain, for example:

- Base domain: `abc.com`
- Created address: `name@x7k2p9q1.abc.com`

This is useful for mailbox isolation and reducing repeated hits on the same address.

Add these worker variables:

```toml
RANDOM_SUBDOMAIN_DOMAINS = ["abc.com"]
RANDOM_SUBDOMAIN_LENGTH = 8
```

- `RANDOM_SUBDOMAIN_DOMAINS`: base domains that allow optional random second-level subdomains
- `RANDOM_SUBDOMAIN_LENGTH`: random string length, range `1-63`, default `8`

The create-address APIs only generate a random subdomain when the request explicitly passes
`enableRandomSubdomain: true`. The frontend sends this field when the "enable random subdomain"
option is checked. If you call `/api/new_address` or `/admin/new_address` yourself, include it in
the request body:

```json
{
  "name": "test",
  "domain": "abc.com",
  "enableRandomSubdomain": true
}
```

`domain` must be the base domain configured in `RANDOM_SUBDOMAIN_DOMAINS`, such as `abc.com`.
If you want to create an address under a specific subdomain such as `team.abc.com`, do not pass
`enableRandomSubdomain: true`; use the direct-subdomain flow below instead.

> [!NOTE]
> This feature only appends a random second-level subdomain when the mailbox is created.
>
> There is currently no backend switch that globally forces random subdomains; API calls that do
> not pass `enableRandomSubdomain: true` will not randomize automatically.

> [!IMPORTANT] A wildcard MX DNS record is required for random subdomains
> The worker only generates addresses like `name@<random>.abc.com` — **whether mail actually
> arrives depends entirely on DNS / Email Routing being configured for `*.abc.com`**, and
> Cloudflare Email Routing does **not** propagate the base-domain configuration onto subdomains.
> See Cloudflare's [Email Routing — Subdomains](https://developers.cloudflare.com/email-routing/setup/subdomains/)
> documentation.
>
> There are two ways to make `*.abc.com` deliverable:
>
> 1. **DNS-only wildcard MX (simplest workaround)** — In your DNS, copy **every existing MX
>    record on `abc.com`** to host `*`, preserving each record's **priority and target value**.
>    This makes `*.abc.com` resolve to the same MX targets as the apex, so mail flows into the
>    same Cloudflare Email Routing zone and is picked up by the apex Catch-all rule that points
>    at the Worker. No extra Cloudflare-side action is needed.
> 2. **Cloudflare dashboard "Add subdomain"** — Add the specific subdomain in the Email Routing
>    dashboard and configure its DNS + Catch-all routing rule separately. This only covers the
>    specific subdomain you add, so it is not suitable for arbitrary random subdomains.
>
> For random subdomain mailboxes, option **(1)** is the recommended path. Without it, the
> random subdomain feature will appear to work in the UI but inbound mail will never reach the
> Worker.
>
> Reference issue: [#1035](https://github.com/dreamhunter2333/cloudflare_temp_email/issues/1035)

## Let APIs Specify Subdomains Directly

If you do not want the system to generate a random subdomain, and instead want the caller to
explicitly create addresses like `team.abc.com`, enable:

```toml
ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH = true
```

When this is enabled, as long as `abc.com` is in the allowed base-domain list, the following
addresses can be created through `/api/new_address` or `/admin/new_address`:

- `name@team.abc.com`
- `name@dev.team.abc.com`

> [!NOTE]
> This only relaxes the domain validation used by the create-address APIs. It does not change the
> default domain dropdown, and it does not create Cloudflare-side subdomain mail routes for you.
>
> If the admin panel has already saved an override once, you can switch it back to **Follow Environment Variable** to clear the override and return to env fallback behavior.
