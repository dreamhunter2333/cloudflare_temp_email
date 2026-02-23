# Admin Console

> [!NOTE]
> You need to configure `ADMIN_PASSWORDS` or `ADMIN_USER_ROLE` to access the admin console
> Admin role configuration: if the user role equals ADMIN_USER_ROLE, they can access the admin console

After deploying the frontend application, click the upper-left logo 5 times or visit the `/admin` path to enter the management console.

You need to configure `ADMIN_PASSWORDS` in the backend or ensure the current user role is `ADMIN_USER_ROLE`, otherwise access to the console will be denied.

![admin](/feature/admin.png)

## If your website is for private access only, you can disable this check

`DISABLE_ADMIN_PASSWORD_CHECK = true`
