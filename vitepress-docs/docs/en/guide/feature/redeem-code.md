# Redemption Codes

Set `ENABLE_REDEEM_CODE = true` to enable the standalone `/redeem` page for code validation and benefit fulfillment. Payment, orders, inventory, and card issuing stay outside this project. Codes generated in Admin can be exported to an external sales platform. When disabled, the page entry, Admin menu, and related APIs are unavailable.

Optionally set `REDEEM_CODE_URL` to the external page where users obtain codes. The redemption page hides this link when the variable is unset.

## Database

Run the database migration from the Admin database page after upgrading. The migration files and `db/schema.sql` are the source of truth for the table structure.

When Admin creates codes, the Worker uses `crypto.randomUUID()` to generate UUID v4 codes without a fixed prefix. `code` stores the case-sensitive plaintext redemption code so Admin exports can contain usable codes. `redeem_type` selects the business handler, and `value` is a plain string parsed by that handler. The system maintains `redeemed`, `result`, and the redemption timestamp. `result` stores the JSON redemption result encrypted with AES-256-GCM using a key derived from `JWT_SECRET`. Every code requires a future `expires_at`; redemption and result retrieval stop after it expires. Changing `JWT_SECRET` invalidates both existing address credentials and stored redemption results.

The external platform only sells and distributes codes exported from Admin. This project does not handle payment, orders, or inventory.

## Supported benefits

### Role benefits

```text
redeem_type = role
value = vip
```

The role must exist in `USER_ROLES` and cannot equal `ADMIN_USER_ROLE`. Redemption applies all prefix, domain, address-count, and sending privileges configured for that role. Configure a role with `prefix: ""` for permanent prefix-free addresses.

Redemption refuses to overwrite an existing role that differs from both the default and target roles, leaving the code unused. This check also applies to concurrent redemptions of different roles. When signed-in users redeem for themselves, the page refreshes their role configuration and access token.

### Sending credits

```text
redeem_type = send_balance
value = 100
```

This adds to `address_sender.balance` for the target address entered on the redemption page. Mailboxes without a sender record first receive `DEFAULT_SEND_BALANCE`, then the redeemed credits; existing records do not receive default credits again. Credits belong to an email address. Redemption does not re-enable an address disabled by an administrator.

### Custom mailbox

```text
redeem_type = address_prefix_once
value = vip
```

`value` accepts lowercase letters and digits, or it may be empty, and must leave at least one character under `MAX_ADDRESS_LEN` for user input. The redemption module prepends it directly to the user's input, then creates the address with the system prefix disabled; the configured address-name regex and block list still apply. An empty value therefore creates a prefix-free address. The first redemption creates an address and writes the complete response to `result` in encrypted form. The page only displays the address and credential; it does not switch to or bind the mailbox automatically. Further redemptions before expiry return the same complete result. If temporary-address cleanup removes its row, the result is no longer available and the system does not recreate the address.

## Admin

The Admin redemption-code page filters by one type at a time and shows type-specific business columns. Batch generation and export both use the currently selected type. Codes in one batch share their benefit value, enabled state, and expiry, with a limit of 500 UUID v4 codes per batch. After generation, the page downloads a CSV containing only that batch.

CSV export is also limited to one type per operation and contains usable plaintext codes. The export dialog requires a row limit, capped at 10,000.

## API

| Endpoint | Purpose |
| --- | --- |
| `POST /redeem_api/query` | Query a code's type, value, and status |
| `POST /redeem_api/result` | Retrieve the result of an unexpired redeemed code |
| `POST /redeem_api/redeem` | Create an address, update a role, or add sending credits |

User-facing redemption endpoints bypass address, user, and Admin authentication; the code itself is the business credential. A configured site-access password still takes priority. The endpoints also use IP rate limiting and access controls. Role and credit business writes are atomically consumed once. The first successful special-address request fixes its complete result, which remains retrievable until expiry.

## Adding benefit types

To add a benefit, register a new `redeem_type` handler with strict `value` validation, a safe preview, and its business logic. The `redeem_codes` table does not need to change.
