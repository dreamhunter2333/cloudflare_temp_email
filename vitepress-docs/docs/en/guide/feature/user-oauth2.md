# OAuth2 Third-Party Login

> [!WARNING] Note
> Third-party login will automatically register an account using the user's email (emails with the same address will be considered the same account)
>
> This account is the same as a registered account and can also set a password through the forgot password feature

## Register OAuth2 on Third-Party Platforms

### GitHub

- Please first create an OAuth App, then obtain the `Client ID` and `Client Secret`

Reference: [Creating an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

### Authentik

- [Authentik OAuth2 Provider](https://docs.goauthentik.io/docs/providers/oauth2/)

## Configure OAuth2 in Admin Backend

![oauth2](/feature/oauth2.png)

## Test User Login Page

![oauth2 login](/feature/oauth2-login.png)
