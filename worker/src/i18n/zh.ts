import { LocaleMessages } from "./type";

const messages: LocaleMessages = {
    CustomAuthPasswordMsg: "你已启用私有站点密码,请提供密码",
    UserTokenExpiredMsg: "您的令牌已过期, 请重新登录",
    UserAcceesTokenExpiredMsg: "您的访问令牌已过期, 请刷新页面",
    UserRoleIsNotAdminMsg: "您的用户角色不是管理员, 无权访问",
    NeedAdminPasswordMsg: "您需要提供管理员密码才能访问此页面",

    KVNotAvailableMsg: "KV 不可用, 请联系管理员",
    DBNotAvailableMsg: "DB 不可用, 请联系管理员",
    JWTSecretNotSetMsg: "JWT_SECRET 未设置, 请联系管理员",
    WebhookNotEnabledMsg: "Webhook 未启用, 请联系管理员",
    DomainsNotSetMsg: "域名列表未设置, 请联系管理员",

    TurnstileCheckFailedMsg: "人机验证检查失败",
    NewAddressDisabledMsg: "新建邮箱地址已禁用, 请联系管理员",
    NewAddressAnonymousDisabledMsg: "匿名用户新建邮箱地址已禁用, 请联系管理员",
    FailedCreateAddressMsg: "创建邮箱地址失败",
    InvalidAddressMsg: "无效的邮箱地址",
    InvalidAddressCredentialMsg: "无效的邮箱地址凭据",
    UserDeleteEmailDisabledMsg: "用户删除邮箱/邮件已禁用, 请联系管理员",

    UserNotFoundMsg: "用户不存在",
    UserAlreadyExistsMsg: "用户已存在, 请登录",
    FailedToRegisterMsg: "注册失败",
    UserRegistrationDisabledMsg: "用户注册已禁用, 请联系管理员",
    UserMailDomainMustInMsg: "用户邮箱域必须在此列表中",
    UserEmailNotMatchRegexMsg: "邮箱地址格式不符合要求",
    InvalidVerifyCodeMsg: "无效的验证码",
    InvalidEmailOrPasswordMsg: "无效的邮箱或密码",
    VerifyMailSenderNotSetMsg: "验证邮件发送邮箱未设置, 请联系管理员",
    CodeAlreadySentMsg: "验证码已发送, 请稍等",
    InvalidUserDefaultRoleMsg: "无效的用户默认角色, 请联系管理员",
    FailedUpdateUserDefaultRoleMsg: "更新用户默认角色失败, 请联系管理员",

    Oauth2ClientIDNotFoundMsg: "Oauth2 客户端 ID 未设置, 请联系管理员",
    Oauth2CliendIDOrCodeMissingMsg: "Oauth2 客户端 ID 或 code 缺失",
    Oauth2FailedGetUserInfoMsg: "从 Oauth2 提供商获取用户信息失败",
    Oauth2FailedGetAccessTokenMsg: "从 Oauth2 提供商获取访问令牌失败",
    Oauth2FailedGetUserEmailMsg: "从 Oauth2 提供商获取用户邮箱失败",

    PasswordChangeDisabledMsg: "密码修改已禁用",
    NewPasswordRequiredMsg: "新密码不能为空",
    InvalidAddressTokenMsg: "无效的地址令牌",
    FailedUpdatePasswordMsg: "更新密码失败",
    PasswordLoginDisabledMsg: "密码登录已禁用",
    EmailPasswordRequiredMsg: "邮箱和密码不能为空",
    AddressNotFoundMsg: "邮箱地址不存在",

    // Common messages (merged similar ones)
    OperationFailedMsg: "操作失败",
    RequiredFieldMsg: "缺少必填字段",
    InvalidInputMsg: "输入无效",

    // Address related
    NameTooShortMsg: "名称太短",
    NameTooLongMsg: "名称太长",
    InvalidDomainMsg: "无效的域名",
    AddressAlreadyExistsMsg: "邮箱地址已存在",
    MaxAddressCountReachedMsg: "已达到最大地址数量限制",
    AddressNotBindedMsg: "邮箱地址未绑定",
    AddressAlreadyBindedMsg: "邮箱地址已绑定, 请先解绑",
    TargetUserNotFoundMsg: "目标用户不存在",

    // Send mail related
    NoBalanceMsg: "余额不足",
    AddressBlockedMsg: "地址已被屏蔽",
    SubjectEmptyMsg: "主题不能为空",
    ContentEmptyMsg: "内容不能为空",
    AlreadyRequestedMsg: "已经申请过了",
    EnableResendOrSmtpMsg: "请先为此域名启用 resend 或 smtp",
    EnableResendOrSmtpWithVerifiedMsg: "请先为此域名启用 resend 或 smtp，或将收件人添加到已验证地址列表",
    InvalidToMailMsg: "收件人地址无效",

    // Admin related
    InvalidAddressIdMsg: "无效的 address_id",
    EnableKVMsg: "请先启用 KV",
    EnableSendMailMsg: "请先启用 SEND_MAIL",
    InvalidCleanupConfigMsg: "无效的 cleanType 或 cleanDays",
    InvalidCleanTypeMsg: "无效的 cleanType",
    EnableKVForMailVerifyMsg: "如果要启用邮件验证，请先启用 KV",
    VerifyMailDomainInvalidMsg: "验证邮件发送者域名必须在",
    InvalidMaxAddressCountMsg: "无效的 maxAddressCount",
    FailedDeleteUserMsg: "删除用户失败",
    InvalidUserIdMsg: "无效的 user_id",
    InvalidRoleTextMsg: "无效的 role_text",

    // SQL validation
    SqlEmptyMsg: "SQL 语句为空",
    SqlTooLongMsg: "SQL 语句过长 (最大 1000 字符)",
    SqlOnlyDeleteMsg: "只允许 DELETE 语句",
    SqlSingleStatementMsg: "只允许单条 SQL 语句",
    SqlNoCommentsMsg: "不允许 SQL 注释",

    // Passkey related
    InvalidPasskeyNameMsg: "无效的 passkey 名称",
    PasskeyNotFoundMsg: "Passkey 不存在",
    AuthenticationFailedMsg: "认证失败",
    RegistrationFailedMsg: "注册失败",

    // Auto reply related
    AutoReplyDisabledMsg: "自动回复已禁用",
    InvalidAutoReplyMsg: "无效的主题或消息",
    SubjectOrMessageTooLongMsg: "主题或消息太长",

    // Bind address related
    NoAddressOrUserTokenMsg: "缺少地址或用户令牌",
    InvalidAddressOrUserTokenMsg: "无效的地址或用户令牌",

    // Pagination related
    InvalidLimitMsg: "无效的 limit 参数",
    InvalidOffsetMsg: "无效的 offset 参数",

    // Clear inbox/sent items related
    FailedClearInboxMsg: "清空收件箱失败",
    FailedClearSentItemsMsg: "清空已发送邮件失败",

    // Webhook related
    WebhookNotAllowedForUserMsg: "此用户不允许使用 Webhook 设置",

    // IP blacklist related
    InvalidIpBlacklistSettingMsg: "无效的 IP 黑名单设置",
    BlacklistExceedsMaxSizeMsg: "黑名单超出最大条目限制",

    // Telegram bot messages
    TgUnableGetUserInfoMsg: "无法获取用户信息",
    TgNoPermissionMsg: "您没有权限使用此机器人",
    TgWelcomeMsg: "欢迎使用本机器人, 您可以打开 mini app",
    TgCurrentPrefixMsg: "当前已启用前缀:",
    TgCurrentDomainsMsg: "当前可用域名:",
    TgAvailableCommandsMsg: "请使用以下命令:",
    TgCreateSuccessMsg: "创建地址成功:",
    TgCreateFailedMsg: "创建地址失败:",
    TgBindSuccessMsg: "绑定成功:",
    TgBindFailedMsg: "绑定失败:",
    TgUnbindSuccessMsg: "解绑成功:",
    TgUnbindFailedMsg: "解绑失败:",
    TgDeleteSuccessMsg: "删除成功:",
    TgDeleteFailedMsg: "删除失败:",
    TgAddressListMsg: "地址列表:",
    TgGetAddressFailedMsg: "获取地址列表失败:",
    TgCleanSuccessMsg: "清理无效地址成功:",
    TgCurrentAddressListMsg: "当前地址列表:",
    TgCleanFailedMsg: "清理无效地址失败:",
    TgNotBoundAddressMsg: "未绑定此地址:",
    TgInvalidAddressMsg: "无效地址",
    TgNoMoreMailsMsg: "已经没有邮件了",
    TgNoMailMsg: "无邮件",
    TgGetMailFailedMsg: "获取邮件失败:",
    TgParseMailFailedMsg: "解析邮件失败:",
    TgViewMailBtnMsg: "查看邮件",
    TgPrevBtnMsg: "上一条",
    TgNextBtnMsg: "下一条",
    TgPleaseInputCredentialMsg: "请输入凭证",
    TgPleaseInputAddressMsg: "请输入地址",
    TgAddressMsg: "地址:",
    TgPasswordMsg: "密码:",
    TgCredentialMsg: "凭证:",
    TgNoSenderMsg: "无发件人",
    TgMsgTooLongMsg: "消息过长请到 mini app 查看",
    TgParseFailedViewInAppMsg: "解析失败，请打开 mini app 查看",
    TgMaxAddressReachedMsg: "绑定地址数量已达上限",
    TgMaxAddressReachedCleanMsg: "绑定地址数量已达上限, 请先 /cleaninvalidaddress",
    TgInvalidCredentialMsg: "无效凭证",
    TgAddressNotYoursMsg: "此地址不属于您",
    TgLangSetSuccessMsg: "语言设置成功:",
    TgCurrentLangMsg: "当前语言:",
    TgSelectLangMsg: "请选择语言:",
    TgNoPermissionViewMailMsg: "无权查看此邮件",
    TgBotTokenRequiredMsg: "需要设置 TELEGRAM_BOT_TOKEN",
    TgLangFeatureDisabledMsg: "语言设置功能已禁用，使用系统默认语言",
}

export default messages;
