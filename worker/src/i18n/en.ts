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
    UserDeleteEmailDisabledMsg: "User delete address/email is disabled, please contact the administrator",
}

export default messages;
