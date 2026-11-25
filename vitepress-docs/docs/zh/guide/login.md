# 登录入口与凭据

前端的三个入口对应不同对象，使用的凭据也不同：

| 入口 | 用途 | 登录凭据 |
|------|------|----------|
| `/`（或 `/:lang/`） | 打开单个邮箱，查看收件箱、发件箱和邮箱设置 | 邮箱会话 Token（Address JWT）；启用 `ENABLE_ADDRESS_PASSWORD` 后也可使用邮箱密码；再同时启用 `ADDRESS_PASSWORD_LOGIN_ONLY` 后，登录页仅提供邮箱密码登录 |
| `/user`（或 `/:lang/user`） | 登录用户中心，管理一个用户账号下绑定的多个邮箱 | 未启用 `DISABLE_USER_SYSTEM` 时可用；使用用户账号邮箱与密码、Passkey 或已配置的 OAuth2 |
| `/admin`（或 `/:lang/admin`） | 进入管理后台 | `ADMIN_PASSWORDS`；未启用 `DISABLE_USER_SYSTEM` 时，也可使用具有 `ADMIN_USER_ROLE` 的用户账号 |

用户账号的登录邮箱不会自动成为收发邮件的邮箱地址。登录用户中心后，可在“收件箱”页签查看邮件；如需直接打开单个邮箱，可从邮箱列表选择“进入邮箱”。只登录某个邮箱也不会自动登录用户中心。
