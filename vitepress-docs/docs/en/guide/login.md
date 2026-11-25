# Login Entry Points and Credentials

The frontend has three entry points for different objects, and they do not share the same credentials:

| Entry point | Purpose | Credentials |
|-------------|---------|-------------|
| `/` (or `/:lang/`) | Open one mailbox and access its inbox, sent mail, and mailbox settings | Mailbox session token (Address JWT). Enabling `ENABLE_ADDRESS_PASSWORD` also allows mailbox-password login; enabling `ADDRESS_PASSWORD_LOGIN_ONLY` at the same time makes the login page password-only. |
| `/user` (or `/:lang/user`) | Sign in to the User Center and manage multiple mailboxes linked to one user account | Available when `DISABLE_USER_SYSTEM` is not enabled; uses account email and password, passkey, or a configured OAuth2 provider |
| `/admin` (or `/:lang/admin`) | Open the Admin Console | `ADMIN_PASSWORDS`; when `DISABLE_USER_SYSTEM` is not enabled, a user account whose role matches `ADMIN_USER_ROLE` also works |

The account email used to sign in to the User Center is not automatically a sending or receiving address. After signing in, you can view mail from the **Inbox** tab; to open one mailbox directly, select **Open Mailbox** from the mailbox list. Signing in to one mailbox does not sign in to the User Center either.
