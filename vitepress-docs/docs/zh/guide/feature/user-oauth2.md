# OAuth2 第三方登录

> [!WARNING] 注意
> 第三方登录会自动使用用户邮箱注册账号(邮箱相同将视为同一账号)
>
> 此账号和注册的账号相同, 也可以通过忘记密码设置密码

## 在第三方平台注册 OAuth2

### GitHub

- 请先创建一个 OAuth App，然后获取 `Client ID` 和 `Client Secret`

参考 [Creating an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

### Authentik

- [Authentik OAuth2 Provider](https://docs.goauthentik.io/docs/providers/oauth2/)

## Admin 后台配置 OAuth2

![oauth2](/feature/oauth2.png)

## 测试用户登录页面

![oauth2 login](/feature/oauth2-login.png)
