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
}

export type TelegramMessages = {
    commands: {
        start: string
        new: string
        address: string
        bind: string
        unbind: string
        delete: string
        mails: string
        cleaninvalidaddress: string
    }
    unableGetUserInfo: string
    noPermission: string
    welcome: string
    currentPrefix: string
    currentDomains: string
    pleaseUseCommands: string
    address: string
    password: string
    credential: string
    createSuccess: string
    createFailed: string
    pleaseInputCredential: string
    bindSuccess: string
    bindFailed: string
    pleaseInputAddress: string
    unbindSuccess: string
    unbindFailed: string
    deleteSuccess: string
    deleteFailed: string
    addressList: string
    getAddressListFailed: string
    cleanSuccess: string
    currentAddressList: string
    cleanFailed: string
    noMoreMails: string
    viewMail: string
    previous: string
    next: string
    getMailFailed: string
    noMail: string
    addressNotBound: string
    invalidAddress: string
    from: string
    noSender: string
    to: string
    date: string
    subject: string
    content: string
    parseFailed: string
    messageTooLong: string
    parseMailFailed: string
    noPermissionViewMail: string
    addressLimitReached: string
    addressLimitReachedClean: string
    nameBlocked: string
    invalidCredential: string
    invalidJwt: string
    addressNotYours: string
}
