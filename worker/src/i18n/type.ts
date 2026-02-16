export type LocaleMessages = {
    CustomAuthPasswordMsg: string
    UserTokenExpiredMsg: string
    UserAcceesTokenExpiredMsg: string
    UserRoleIsNotAdminMsg: string
    NeedAdminPasswordMsg: string

    KVNotAvailableMsg: string
    DBNotAvailableMsg: string
    JWTSecretNotSetMsg: string
    WebhookNotEnabledMsg: string
    DomainsNotSetMsg: string

    TurnstileCheckFailedMsg: string
    NewAddressDisabledMsg: string
    NewAddressAnonymousDisabledMsg: string
    FailedCreateAddressMsg: string
    InvalidAddressMsg: string
    InvalidAddressCredentialMsg: string
    UserDeleteEmailDisabledMsg: string

    UserNotFoundMsg: string
    UserAlreadyExistsMsg: string
    FailedToRegisterMsg: string
    UserRegistrationDisabledMsg: string
    UserMailDomainMustInMsg: string
    UserEmailNotMatchRegexMsg: string
    InvalidVerifyCodeMsg: string
    InvalidEmailOrPasswordMsg: string
    VerifyMailSenderNotSetMsg: string
    CodeAlreadySentMsg: string
    InvalidUserDefaultRoleMsg: string
    FailedUpdateUserDefaultRoleMsg: string

    Oauth2ClientIDNotFoundMsg: string
    Oauth2CliendIDOrCodeMissingMsg: string
    Oauth2FailedGetUserInfoMsg: string
    Oauth2FailedGetAccessTokenMsg: string
    Oauth2FailedGetUserEmailMsg: string

    PasswordChangeDisabledMsg: string
    NewPasswordRequiredMsg: string
    InvalidAddressTokenMsg: string
    FailedUpdatePasswordMsg: string
    PasswordLoginDisabledMsg: string
    EmailPasswordRequiredMsg: string
    AddressNotFoundMsg: string

    // Common messages (merged similar ones)
    OperationFailedMsg: string
    RequiredFieldMsg: string
    InvalidInputMsg: string

    // Address related
    NameTooShortMsg: string
    NameTooLongMsg: string
    InvalidDomainMsg: string
    AddressAlreadyExistsMsg: string
    MaxAddressCountReachedMsg: string
    AddressNotBindedMsg: string
    AddressAlreadyBindedMsg: string
    TargetUserNotFoundMsg: string

    // Send mail related
    NoBalanceMsg: string
    AddressBlockedMsg: string
    SubjectEmptyMsg: string
    ContentEmptyMsg: string
    AlreadyRequestedMsg: string
    EnableResendOrSmtpMsg: string
    EnableResendOrSmtpWithVerifiedMsg: string
    InvalidToMailMsg: string

    // Admin related
    InvalidAddressIdMsg: string
    EnableKVMsg: string
    EnableSendMailMsg: string
    InvalidCleanupConfigMsg: string
    InvalidCleanTypeMsg: string
    EnableKVForMailVerifyMsg: string
    VerifyMailDomainInvalidMsg: string
    InvalidMaxAddressCountMsg: string
    FailedDeleteUserMsg: string
    InvalidUserIdMsg: string
    InvalidRoleTextMsg: string

    // SQL validation
    SqlEmptyMsg: string
    SqlTooLongMsg: string
    SqlOnlyDeleteMsg: string
    SqlSingleStatementMsg: string
    SqlNoCommentsMsg: string

    // Passkey related
    InvalidPasskeyNameMsg: string
    PasskeyNotFoundMsg: string
    AuthenticationFailedMsg: string
    RegistrationFailedMsg: string

    // Auto reply related
    AutoReplyDisabledMsg: string
    InvalidAutoReplyMsg: string
    SubjectOrMessageTooLongMsg: string

    // Bind address related
    NoAddressOrUserTokenMsg: string
    InvalidAddressOrUserTokenMsg: string

    // Pagination related
    InvalidLimitMsg: string
    InvalidOffsetMsg: string

    // Clear inbox/sent items related
    FailedClearInboxMsg: string
    FailedClearSentItemsMsg: string

    // Webhook related
    WebhookNotAllowedForUserMsg: string

    // IP blacklist related
    InvalidIpBlacklistSettingMsg: string
    BlacklistExceedsMaxSizeMsg: string

    // Telegram bot messages
    TgUnableGetUserInfoMsg: string
    TgNoPermissionMsg: string
    TgWelcomeMsg: string
    TgCurrentPrefixMsg: string
    TgCurrentDomainsMsg: string
    TgAvailableCommandsMsg: string
    TgCreateSuccessMsg: string
    TgCreateFailedMsg: string
    TgBindSuccessMsg: string
    TgBindFailedMsg: string
    TgUnbindSuccessMsg: string
    TgUnbindFailedMsg: string
    TgDeleteSuccessMsg: string
    TgDeleteFailedMsg: string
    TgAddressListMsg: string
    TgGetAddressFailedMsg: string
    TgCleanSuccessMsg: string
    TgCurrentAddressListMsg: string
    TgCleanFailedMsg: string
    TgNotBoundAddressMsg: string
    TgInvalidAddressMsg: string
    TgNoMoreMailsMsg: string
    TgNoMailMsg: string
    TgGetMailFailedMsg: string
    TgParseMailFailedMsg: string
    TgViewMailBtnMsg: string
    TgPrevBtnMsg: string
    TgNextBtnMsg: string
    TgPleaseInputCredentialMsg: string
    TgPleaseInputAddressMsg: string
    TgAddressMsg: string
    TgPasswordMsg: string
    TgCredentialMsg: string
    TgNoSenderMsg: string
    TgMsgTooLongMsg: string
    TgParseFailedViewInAppMsg: string
    TgMaxAddressReachedMsg: string
    TgMaxAddressReachedCleanMsg: string
    TgInvalidCredentialMsg: string
    TgAddressNotYoursMsg: string
    TgLangSetSuccessMsg: string
    TgCurrentLangMsg: string
    TgSelectLangMsg: string
    TgNoPermissionViewMailMsg: string
    TgBotTokenRequiredMsg: string
    TgLangFeatureDisabledMsg: string
}
