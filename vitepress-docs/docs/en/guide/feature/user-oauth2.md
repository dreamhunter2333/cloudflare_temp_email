# OAuth2 Third-Party Login

> [!WARNING] Note
> Third-party login will automatically register an account using the user's email (emails with the same address will be considered the same account)
>
> This account is the same as a registered account and can also set a password through the forgot password feature

## Register OAuth2 on Third-Party Platforms

### GitHub

- Please first create an OAuth App, then obtain the `Client ID` and `Client Secret`

Reference: [Creating an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

### Linux Do

- Create an application at [Linux Do Connect](https://connect.linux.do/) to obtain `Client ID` and `Client Secret`
- Linux Do returns a user ID instead of an email, so you need to enable the Email Format feature

### Authentik

- [Authentik OAuth2 Provider](https://docs.goauthentik.io/docs/providers/oauth2/)

## Configure OAuth2 in Admin Backend

![oauth2](/feature/oauth2.png)

### Configuration Fields

| Field | Description |
|-------|-------------|
| Name | OAuth2 provider name, displayed on the login page |
| Client ID | OAuth2 application ID |
| Client Secret | OAuth2 application secret |
| Authorization URL | OAuth2 authorization endpoint |
| Access Token URL | Endpoint to obtain Access Token |
| Access Token Params Format | Token request format: `json` or `urlencoded` |
| User Info URL | Endpoint to get user information |
| User Email Key | Key for email field in user info, supports JSONPath (e.g., `$[0].email`) |
| Redirect URL | OAuth2 callback URL |
| Scope | OAuth2 permission scope |

### Email Format Transformation

When OAuth2 returns a non-standard email format (e.g., returns a user ID), you can enable the Email Format feature.

| Field | Description |
|-------|-------------|
| Enable Email Format | Enable email format transformation |
| Email Regex Pattern | Regular expression to match the original value, use capture groups `()` |
| Replace Template | Replacement template, use `$1`, `$2`, etc. to reference capture groups |

**Examples:**

| Scenario | Original Value | Regex Pattern | Replace Template | Result |
|----------|---------------|---------------|------------------|--------|
| ID to Email | `12345` | `^(.+)$` | `linux_do_$1@oauth.linux.do` | `linux_do_12345@oauth.linux.do` |
| Change Domain | `john@old.com` | `^(.+)@old\.com$` | `$1@new.com` | `john@new.com` |
| Extract Username | `john@corp.com` | `^(.+)@.*$` | `$1@mymail.com` | `john@mymail.com` |

### Email Address Allow List

When enabled, only emails from specified domains can login.

## Test User Login Page

![oauth2 login](/feature/oauth2-login.png)
