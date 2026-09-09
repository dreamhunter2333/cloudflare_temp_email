# Password-only mailbox login

```toml
ENABLE_ADDRESS_PASSWORD = true
ADDRESS_PASSWORD_LOGIN_ONLY = true
```

The new switch defaults to `false` and only takes effect when mailbox passwords are enabled. It rejects legacy mailbox credentials, including direct API access, disables the credential login endpoint and `?jwt=` login links, and hides credential displays and automatic login links. Mailbox creation still displays the generated password. Users and administrators can still open mailboxes they are authorized to access and receive a new login JWT.

Existing mailboxes without passwords need a bound user or administrator to set one. Enabling passwords does not generate passwords for existing mailboxes. No database migration is required.

## Mailbox login JWT

Password login returns a `jwt` whose payload adds `type: "address_password_login"`, `iat`, and `exp` to the existing `address` and `address_id` fields. It lasts 30 days. Mailbox APIs continue using `Authorization: Bearer <jwt>`. Middleware validates the signature, type, expiration, and mailbox existence; business APIs keep using the same address fields.

`GET /api/settings` returns the current login information (`address`, `address_id`, and for password login, `type`, `iat`, and `exp`), sending balance, and `new_address_token`. When a valid login JWT has less than 7 days remaining, `new_address_token` contains a newly issued 30-day JWT; otherwise it is `null`.

The frontend follows the user login flow: `getSettings()` loads settings, validates the returned token with another settings request, then updates the current JWT and local mailbox cache. A renewal response cannot overwrite a different selected mailbox. Renewal runs when mailbox settings are loaded; ordinary API requests do not perform additional token checks or refreshes.

The local mailbox cache stores the token with the address and login type returned by `settings`; the frontend does not decode JWTs. Legacy credentials and password login JWTs are retained independently, updating the same address and type after successful login or renewal validation. Lists label the login method. Password-only login hides identified legacy credential entries without deleting them. Historical token-only entries initially appear as “Saved mailbox”; selecting and validating one fills in its information. The backend always rejects disabled credentials.

Expired JWTs cannot be renewed; log in again. Legacy credentials cannot obtain a new login JWT through `settings`. With the switch disabled, existing credentials retain their previous behavior, while password login still returns the new JWT format.

External clients keep the same APIs and headers. Clients using a new login JWT need to accept and save `settings.new_address_token`. Enabling the switch also rejects legacy credentials used directly against mailbox APIs by SMTP/IMAP, Agent, and other clients.

## Telegram bindings

After mailbox creation or binding, Telegram stores a non-expiring token with `type: "telegram_binding"` in KV. This token is internal to Telegram and is rejected by mailbox APIs. The Bot and Mini App authenticate the Telegram user before reading that user's bindings and checking that the mailbox still exists.

When the Mini App opens a mailbox, it issues a mailbox JWT under the current login policy. With password-only login enabled, that JWT lasts 30 days and follows the web renewal flow above. The KV binding does not need to rotate with the web JWT.

Existing KV bindings remain compatible: only internal Telegram binding verification ignores token expiration while validating the signature and mailbox identity. Tokens submitted to create a new binding still follow mailbox API validation, so disabled legacy credentials and expired JWTs cannot create new bindings. Unlinking or deleting a mailbox removes access through that Telegram binding.

## Reset a bound mailbox password

The user center mailbox list offers password reset without the previous mailbox password. This only requires `ENABLE_ADDRESS_PASSWORD`, independently of the password-only switch.

```http
POST /user_api/address/:address_id/reset_password
x-user-token: <user JWT>
Content-Type: application/json

{"new_password":"<64-character lowercase SHA-256 hex digest of the new password>"}
```

The same update statement checks that the user exists and currently owns the binding, and updates only the existing `password` and `updated_at` fields. Success returns `{"success":true}`. Missing user authentication returns 401; a mailbox not bound to the user or disabled passwords returns 403; invalid input returns 400.

Resetting a password does not revoke issued login JWTs; valid login JWTs can still renew. This implementation adds no session table or revocation state.
