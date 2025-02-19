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
    UserDeleteEmailDisabledMsg: "用户删除邮箱/邮件已禁用, 请联系管理员",
}

export default messages;
