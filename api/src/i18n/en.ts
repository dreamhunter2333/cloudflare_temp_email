import { LocaleMessages } from "./type";

const messages: LocaleMessages = {
    CustomAuthPasswordMsg: "You have enabled the private site password, please provide the password",
    UserTokenExpiredMsg: "Your token has expired, please login again",
    UserAcceesTokenExpiredMsg: "Your access token has expired, please refresh the page",
    UserRoleIsNotAdminMsg: "Your user role is not admin, no access to visit this page",
    NeedAdminPasswordMsg: "You need to provide the admin password to access this page",

    KVNotAvailableMsg: "KV is not available, please contact the administrator",
    DBNotAvailableMsg: "DB is not available, please contact the administrator",
    JWTSecretNotSetMsg: "JWT_SECRET is not set, please contact the administrator",
    WebhookNotEnabledMsg: "Webhook is not enabled, please contact the administrator",
    DomainsNotSetMsg: "Domains are not set, please contact the administrator",

    TurnstileCheckFailedMsg: "Human verification check failed",
    NewAddressDisabledMsg: "New address is disabled, please contact the administrator",
    NewAddressAnonymousDisabledMsg: "New address for anonymous user is disabled, please contact the administrator",
    FailedCreateAddressMsg: "Failed to create address",
    InvalidAddressMsg: "Invalid address",
    InvalidAddressCredentialMsg: "Invalid address credential",
    UserDeleteEmailDisabledMsg: "User delete address/email is disabled, please contact the administrator",

    UserNotFoundMsg: "User not found",
    UserAlreadyExistsMsg: "User already exists, please login",
    FailedToRegisterMsg: "Failed to register",
    UserRegistrationDisabledMsg: "User registration is disabled, please contact the administrator",
    UserMailDomainMustInMsg: "User mail domain must be in this list",
    InvalidVerifyCodeMsg: "Invalid verify code",
    InvalidEmailOrPasswordMsg: "Invalid email or password",
    VerifyMailSenderNotSetMsg: "Verify mail sender address is not set, please contact the administrator",
    CodeAlreadySentMsg: "Code already sent, please wait",
    InvalidUserDefaultRoleMsg: "Invalid user default role, please contact the administrator",
    FailedUpdateUserDefaultRoleMsg: "Failed to update user default role, please contact the administrator",

    Oauth2ClientIDNotFoundMsg: "Oauth2 client ID is not set, please contact the administrator",
    Oauth2CliendIDOrCodeMissingMsg: "Oauth2 client ID or code is missing",
    Oauth2FailedGetUserInfoMsg: "Failed to get user info from Oauth2 provider",
    Oauth2FailedGetAccessTokenMsg: "Failed to get access token from Oauth2 provider",
    Oauth2FailedGetUserEmailMsg: "Failed to get user email from Oauth2 provider",
}

export default messages;
