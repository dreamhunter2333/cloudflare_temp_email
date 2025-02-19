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
}

export default messages;
