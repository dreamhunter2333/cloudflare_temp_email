# Admin User Management

## User Management Page

![admin-user-management](/feature/admin-user-management.png)

## User Settings

Configure user registration and email verification here. Disabling registration does not disable login for existing users.

![admin-user-page](/feature/admin-user-page.png)

## Disable the User System

Set `DISABLE_USER_SYSTEM = true` in the Worker to disable the entire user system: all `/user_api/*` endpoints return 403 through a shared middleware, and the frontend hides user interfaces including the user center, user management, and user settings. Leaving it unset preserves existing behavior.

Anonymous mailboxes and admin password login remain available. Do not also enable `DISABLE_ANONYMOUS_USER_CREATE_EMAIL`, or self-service mailbox creation will be unavailable. Disabling the user system does not delete existing users or mailboxes.
