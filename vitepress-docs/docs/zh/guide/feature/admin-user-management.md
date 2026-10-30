# Admin 用户相关

## 用户管理页面

![admin-user-management](/feature/admin-user-management.png)

## 用户设置

此处配置用户注册及邮件验证；关闭注册不会关闭已有用户登录

![admin-user-page](/feature/admin-user-page.png)

## 禁用用户系统

在 Worker 中设置 `DISABLE_USER_SYSTEM = true` 可关闭整个用户系统：所有 `/user_api/*` 接口返回 403，已有用户 token 和角色访问 token 不再参与鉴权，前端隐藏用户中心、用户管理及用户设置入口，直接访问用户页面或 OAuth2 回调会跳回首页。默认不配置时保持原有行为。

匿名邮箱和管理员密码登录仍可使用；请不要同时开启 `DISABLE_ANONYMOUS_USER_CREATE_EMAIL`，否则将无法自助创建邮箱。关闭用户系统不会删除已有用户或邮箱数据。

![User system disabled](/feature/user-system-disabled.png)
