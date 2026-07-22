# Delete Address API

## Admin Delete Address API

Delete an address by address ID. This endpoint requires admin auth and deletes related data (mails, sender settings, bindings, etc.).

```bash
DELETE /admin/delete_address/:id
```

Header:

- `x-admin-auth: <admin_password>`

Example response:

```json
{ "success": true }
```

## User Delete Address API

Delete mailbox by address JWT. The request needs address token permission and deletes related data (received mails, sent items, auto reply data, sender bindings, user bindings, telegram bind records).

```bash
DELETE /api/delete_address
```

Headers:

- `Authorization: Bearer <address_jwt>`

Notes:

- `ENABLE_USER_DELETE_EMAIL` must be enabled.
- Address credential can be obtained from `/api/new_address` or `/admin/new_address`.

Example response:

```json
{ "success": true }
```
