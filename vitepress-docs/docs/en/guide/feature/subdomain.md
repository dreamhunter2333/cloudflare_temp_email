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

`domain` should be the base domain configured in `RANDOM_SUBDOMAIN_DOMAINS`, such as `abc.com`.
If you pass `team.abc.com`, that is the "specify a subdomain directly" flow and no additional
random subdomain will be generated.

> [!NOTE]
> This feature only appends a random second-level subdomain when the mailbox is created.
>
> There is currently no backend switch that globally forces random subdomains; API calls that do
> not pass `enableRandomSubdomain: true` will not randomize automatically.
>
> It does not automatically create Cloudflare-side subdomain mail routes or DNS records for you,
> so make sure the base-domain/subdomain routing is already available first.

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
