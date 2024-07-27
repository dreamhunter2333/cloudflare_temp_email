# Admin 控制台

> [!NOTE]
> 需要配置 `ADMIN_PASSWORDS` 或者 `ADMIN_USER_ROLE` 才可以访问 admin 控制台
> admin 角色配置, 如果用户角色等于 ADMIN_USER_ROLE 则可以访问 admin 控制台

部署前端应用之后，点击 左上角 logo 5 次 或者访问 `/admin` 路径即可进入管理控制台。

需要在后端配置 `ADMIN_PASSWORDS` 或者当前用户角色为 `ADMIN_USER_ROLE`, 则不允许访问控制台。

![admin](/feature/admin.png)
