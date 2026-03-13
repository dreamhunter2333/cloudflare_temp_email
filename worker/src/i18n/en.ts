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
    UserEmailNotMatchRegexMsg: "Email address format does not match the required pattern",
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

    PasswordChangeDisabledMsg: "Password change is disabled",
    NewPasswordRequiredMsg: "New password is required",
    InvalidAddressTokenMsg: "Invalid address token",
    FailedUpdatePasswordMsg: "Failed to update password",
    PasswordLoginDisabledMsg: "Password login is disabled",
    EmailPasswordRequiredMsg: "Email and password are required",
    AddressNotFoundMsg: "Address not found",

    // Common messages (merged similar ones)
    OperationFailedMsg: "Operation failed",
    RequiredFieldMsg: "Required field is missing",
    InvalidInputMsg: "Invalid input",

    // Address related
    NameTooShortMsg: "Name is too short",
    NameTooLongMsg: "Name is too long",
    InvalidDomainMsg: "Invalid domain",
    AddressAlreadyExistsMsg: "Address already exists",
    MaxAddressCountReachedMsg: "Max address count reached",
    AddressNotBindedMsg: "Address is not binded",
    AddressAlreadyBindedMsg: "Address is already binded, please unbind first",
    TargetUserNotFoundMsg: "Target user not found",

    // Send mail related
    NoBalanceMsg: "No balance",
    AddressBlockedMsg: "Address is blocked",
    SubjectEmptyMsg: "Subject is empty",
    ContentEmptyMsg: "Content is empty",
    AlreadyRequestedMsg: "Already requested",
    EnableResendOrSmtpMsg: "Please enable resend or smtp for this domain",
    EnableResendOrSmtpWithVerifiedMsg: "Please enable resend or smtp for this domain, or add recipient to verified address list",
    InvalidToMailMsg: "Invalid recipient address",

    // Admin related
    InvalidAddressIdMsg: "Invalid address_id",
    EnableKVMsg: "Please enable KV first",
    EnableSendMailMsg: "Please enable SEND_MAIL first",
    InvalidCleanupConfigMsg: "Invalid cleanType or cleanDays",
    InvalidCleanTypeMsg: "Invalid cleanType",
    EnableKVForMailVerifyMsg: "Please enable KV first if you want to enable mail verify",
    VerifyMailDomainInvalidMsg: "VerifyMailSender domain must be in",
    InvalidMaxAddressCountMsg: "Invalid maxAddressCount",
    FailedDeleteUserMsg: "Failed to delete user",
    InvalidUserIdMsg: "Invalid user_id",
    InvalidRoleTextMsg: "Invalid role_text",

    // SQL validation
    SqlEmptyMsg: "SQL statement is empty",
    SqlTooLongMsg: "SQL statement is too long (max 1000 characters)",
    SqlOnlyDeleteMsg: "Only DELETE statements are allowed",
    SqlSingleStatementMsg: "Only single SQL statement is allowed",
    SqlNoCommentsMsg: "SQL comments are not allowed",

    // Passkey related
    InvalidPasskeyNameMsg: "Invalid passkey name",
    PasskeyNotFoundMsg: "Passkey not found",
    AuthenticationFailedMsg: "Authentication failed",
    RegistrationFailedMsg: "Registration failed",

    // Auto reply related
    AutoReplyDisabledMsg: "Auto reply is disabled",
    InvalidAutoReplyMsg: "Invalid subject or message",
    SubjectOrMessageTooLongMsg: "Subject or message is too long",

    // Bind address related
    NoAddressOrUserTokenMsg: "No address or user token",
    InvalidAddressOrUserTokenMsg: "Invalid address or user token",

    // Pagination related
    InvalidLimitMsg: "Invalid limit",
    InvalidOffsetMsg: "Invalid offset",

    // Clear inbox/sent items related
    FailedClearInboxMsg: "Failed to clear inbox",
    FailedClearSentItemsMsg: "Failed to clear sent items",

    // Webhook related
    WebhookNotAllowedForUserMsg: "Webhook settings is not allowed for this user",

    // IP blacklist related
    InvalidIpBlacklistSettingMsg: "Invalid IP blacklist setting",
    BlacklistExceedsMaxSizeMsg: "Blacklist exceeds maximum size",

    // Telegram bot messages
    TgUnableGetUserInfoMsg: "Unable to get user info",
    TgNoPermissionMsg: "You don't have permission to use this bot",
    TgWelcomeMsg: "Welcome! You can open the mini app",
    TgCurrentPrefixMsg: "Current prefix enabled:",
    TgCurrentDomainsMsg: "Available domains:",
    TgAvailableCommandsMsg: "Available commands:",
    TgCreateSuccessMsg: "Address created successfully:",
    TgCreateFailedMsg: "Failed to create address:",
    TgBindSuccessMsg: "Binding successful:",
    TgBindFailedMsg: "Binding failed:",
    TgUnbindSuccessMsg: "Unbinding successful:",
    TgUnbindFailedMsg: "Unbinding failed:",
    TgDeleteSuccessMsg: "Deleted successfully:",
    TgDeleteFailedMsg: "Delete failed:",
    TgAddressListMsg: "Address list:",
    TgGetAddressFailedMsg: "Failed to get address list:",
    TgCleanSuccessMsg: "Invalid addresses cleaned:",
    TgCurrentAddressListMsg: "Current address list:",
    TgCleanFailedMsg: "Failed to clean invalid addresses:",
    TgNotBoundAddressMsg: "This address is not bound:",
    TgInvalidAddressMsg: "Invalid address",
    TgNoMoreMailsMsg: "No more mails",
    TgNoMailMsg: "No mail",
    TgGetMailFailedMsg: "Failed to get mail:",
    TgParseMailFailedMsg: "Failed to parse mail:",
    TgViewMailBtnMsg: "View Mail",
    TgPrevBtnMsg: "Prev",
    TgNextBtnMsg: "Next",
    TgPleaseInputCredentialMsg: "Please enter credential",
    TgPleaseInputAddressMsg: "Please enter address",
    TgAddressMsg: "Address:",
    TgPasswordMsg: "Password:",
    TgCredentialMsg: "Credential:",
    TgNoSenderMsg: "No sender",
    TgMsgTooLongMsg: "Message too long, please view in mini app",
    TgParseFailedViewInAppMsg: "Parse failed, please view in mini app",
    TgMaxAddressReachedMsg: "Maximum address limit reached",
    TgMaxAddressReachedCleanMsg: "Maximum address limit reached, please /cleaninvalidaddress first",
    TgInvalidCredentialMsg: "Invalid credential",
    TgAddressNotYoursMsg: "This address does not belong to you",
    TgLangSetSuccessMsg: "Language set successfully:",
    TgCurrentLangMsg: "Current language:",
    TgSelectLangMsg: "Please select language:",
    TgNoPermissionViewMailMsg: "No permission to view this mail",
    TgBotTokenRequiredMsg: "TELEGRAM_BOT_TOKEN is required",
    TgLangFeatureDisabledMsg: "Language setting feature is disabled. System default language is used.",
}

export default messages;
