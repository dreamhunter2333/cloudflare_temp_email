# Admin User Management

## User Management Page

![admin-user-management](/feature/admin-user-management.png)

## User Settings

Configure user registration and email verification here. Disabling registration does not disable login for existing users.

![admin-user-page](/feature/admin-user-page.png)

## Disable the User System

Set `DISABLE_USER_SYSTEM = true` in the Worker to disable the entire user system: all `/user_api/*` endpoints return 403, existing user tokens and role access tokens no longer participate in authentication, and the frontend hides the user center, user management, and user settings entries. Direct visits to user pages or the OAuth2 callback redirect to the home page. Leaving it unset preserves existing behavior.

Anonymous mailboxes and admin password login remain available. Do not also enable `DISABLE_ANONYMOUS_USER_CREATE_EMAIL`, or self-service mailbox creation will be unavailable. Disabling the user system does not delete existing users or mailboxes.

![User system disabled](/feature/user-system-disabled.png)
