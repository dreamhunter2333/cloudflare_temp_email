# Admin Console

> [!NOTE]
> You need to configure `ADMIN_PASSWORDS` or `ADMIN_USER_ROLE` to access the admin console
> Admin role configuration: if the user role equals ADMIN_USER_ROLE, they can access the admin console

After deploying the frontend application, click the upper-left logo 5 times or visit the `/admin` path to enter the Admin Console.

You need to configure `ADMIN_PASSWORDS` in the backend or ensure the current user role is `ADMIN_USER_ROLE`, otherwise access to the console will be denied.

## Admin Passwords vs User Accounts

`ADMIN_PASSWORDS` is the password for the Admin Console. It is not a site user account
and does not correspond to any mailbox. Logging in with an admin password grants access to
the console, but that login itself cannot receive mail.

Site user accounts are stored in the `users` table and use the user login flow. Whether a user can
receive mail depends on whether they created or bound a mailbox. Creating a normal user
whose account email is `admin@example.com` does not automatically grant admin permissions.

If you want a user account to access the Admin console, configure `ADMIN_USER_ROLE` and assign the
same role to that user in user management.

![admin](/feature/admin.png)

## Statistics Dashboard

The top row shows totals for retained mail, mailboxes, users and sent mail, independent of the selected time range. Time changes do not query totals again. Mailbox-domain filters apply to mail, mailboxes and sent mail; user totals remain site-wide.

The **Statistics** page shows linked line charts for received mail, new mailboxes, sent mail, and new users, with shared time-range and mailbox-domain filters. Use the time button to select today, the last 7 or 30 days, or a custom range of up to 30 days. Custom dates take effect after **Apply**. Single-day charts use hourly buckets; other ranges use daily buckets, all in UTC. ECharts loads lazily and supports linked tooltips and zooming.

Domain options come from configured mailbox domains without scanning mail to populate the selector. User growth is site-wide and unaffected by the mailbox-domain filter. Charts count retained records, exclude deleted data, and do not represent net growth.

Trends query only the selected dates, aggregating time buckets and mailbox domains once for reuse across domain filters. Site-wide totals use direct counts. Domain totals are aggregated on demand only when filtering by domain, then reused across all domains independently of date parameters. The existing Cache API caches snapshots for 10 minutes. Cached larger date ranges can be reused in the browser, and identical concurrent requests within one Worker isolate are coalesced. KV is not used, and no D1 cache table or receive-path counter writes are added. Cache API entries are local to each data center, so computation is not globally once-only.

Database migration v0.0.11 adds the user creation-time index. Existing databases must apply the migration before user trends can use that index.

## Mailbox List Sorting

**Admin Console → Mailbox Management → Mailboxes** supports column sorting. Click a column header to toggle ascending/descending order for:

- ID
- Email Address
- Created At
- Updated At
- Mail Count
- Send Count

When searching for email addresses, pagination automatically resets to page 1.

## If your website is for private access only, you can disable this check

`DISABLE_ADMIN_PASSWORD_CHECK = true`

## IP Blacklist / Whitelist

Configure access control in Admin Console → **IP Blacklist Settings**. Applies to: create address, send mail, external send mail API, user registration, and verify code endpoints.

### IP Whitelist (Strict Mode)

When enabled, **only** whitelisted IPs can access protected endpoints; all others receive 403.

- Plain entries: exact match (no substring), e.g. `1.2.3.4`
- Regex entries: use anchored patterns, e.g. `^192\.168\.1\.\d+$`
- Whitelisted IPs skip blacklist checks
- If whitelist is enabled but the list is empty, the server ignores the switch (fail-open to prevent lockout)

### IP Blacklist

When enabled, matching IPs receive 403. Supports substring text matching or regex.

### ASN Organization Blacklist

Block by ISP/provider name, case-insensitive. Supports text or regex matching.

### Browser Fingerprint Blacklist

Block by `x-fingerprint` request header. Supports exact or regex matching.

### Daily Request Limit

Limit the maximum number of requests per IP per day (1–1,000,000). Exceeding the limit returns 429. Counter resets every 24 hours (UTC date boundary).
