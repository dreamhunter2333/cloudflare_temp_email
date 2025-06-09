type UserRole = {
    domains: string[] | undefined | null,
    role: string,
    prefix: string | undefined | null
}

type Bindings = {
    // bindings
    DB: D1Database
    KV: KVNamespace
    RATE_LIMITER: any
    SEND_MAIL: any
    ASSETS: Fetcher

    // config
    DEFAULT_LANG: string | undefined
    TITLE: string | undefined
    ANNOUNCEMENT: string | undefined | null
    ALWAYS_SHOW_ANNOUNCEMENT: string | boolean | undefined
    PREFIX: string | undefined
    ADDRESS_CHECK_REGEX: string | undefined
    ADDRESS_REGEX: string | undefined
    MIN_ADDRESS_LEN: string | number | undefined
    MAX_ADDRESS_LEN: string | number | undefined
    DEFAULT_DOMAINS: string | string[] | undefined
    DOMAINS: string | string[] | undefined
    ADMIN_USER_ROLE: string | undefined
    USER_DEFAULT_ROLE: string | UserRole | undefined
    USER_ROLES: string | UserRole[] | undefined
    DOMAIN_LABELS: string | string[] | undefined
    PASSWORDS: string | string[] | undefined
    ADMIN_PASSWORDS: string | string[] | undefined
    DISABLE_ADMIN_PASSWORD_CHECK: string | boolean | undefined
    JWT_SECRET: string
    BLACK_LIST: string | undefined
    ENABLE_AUTO_REPLY: string | boolean | undefined
    ENABLE_WEBHOOK: string | boolean | undefined
    ENABLE_USER_CREATE_EMAIL: string | boolean | undefined
    DISABLE_ANONYMOUS_USER_CREATE_EMAIL: string | boolean | undefined
    ENABLE_USER_DELETE_EMAIL: string | boolean | undefined
    ENABLE_INDEX_ABOUT: string | boolean | undefined
    DEFAULT_SEND_BALANCE: number | string | undefined
    NO_LIMIT_SEND_ROLE: string | undefined | null
    ADMIN_CONTACT: string | undefined
    COPYRIGHT: string | undefined
    DISABLE_SHOW_GITHUB: string | boolean | undefined
    FORWARD_ADDRESS_LIST: string | string[] | undefined

    ENABLE_CHECK_JUNK_MAIL: string | boolean | undefined
    JUNK_MAIL_CHECK_LIST: string | string[] | undefined
    JUNK_MAIL_FORCE_PASS_LIST: string | string[] | undefined

    ENABLE_ANOTHER_WORKER: string | boolean | undefined
    ANOTHER_WORKER_LIST: string | AnotherWorker[] | undefined

    SUBDOMAIN_FORWARD_ADDRESS_LIST: string | SubdomainForwardAddressList[] | undefined

    REMOVE_ALL_ATTACHMENT: string | boolean | undefined
    REMOVE_EXCEED_SIZE_ATTACHMENT: string | boolean | undefined

    // s3 config
    S3_ENDPOINT: string | undefined
    S3_ACCESS_KEY_ID: string | undefined
    S3_SECRET_ACCESS_KEY: string | undefined
    S3_BUCKET: string | undefined
    S3_URL_EXPIRES: number | undefined

    // cf turnstile
    CF_TURNSTILE_SITE_KEY: string | undefined
    CF_TURNSTILE_SECRET_KEY: string | undefined

    // resend
    RESEND_TOKEN: string | undefined
    [key: `RESEND_TOKEN_${string}`]: string | undefined

    // SMTP config
    SMTP_CONFIG: string | object | undefined

    // telegram config
    TELEGRAM_BOT_TOKEN: string
    TG_MAX_ADDRESS: number | undefined
    TG_BOT_INFO: string | object | undefined

    // webhook config
    FRONTEND_URL: string | undefined
}

type JwtPayload = {
    address: string
    address_id: number
}

type UserPayload = {
    user_email: string
    user_id: number
    exp: number
    iat: number
}

type Variables = {
    userPayload: UserPayload,
    userRolePayload: string | undefined | null,
    jwtPayload: JwtPayload,
    lang: string | undefined | null
}

type HonoCustomType = {
    "Bindings": Bindings;
    "Variables": Variables;
}

type AnotherWorker = {
    binding: string | undefined | null,
    method: string | undefined | null,
    keywords: string[] | undefined | null
}

type RPCEmailMessage = {
    from: string | undefined | null,
    to: string | undefined | null,
    rawEmail: string | undefined | null,
    headers: object | undefined | null,
}

type ParsedEmailContext = {
    rawEmail: string,
    parsedEmail?: {
        sender: string,
        subject: string,
        text: string,
        html: string,
        headers?: Record<string, string>[]
    } | undefined
}

type SubdomainForwardAddressList = {
    domains: string[] | undefined | null,
    forward: string,
}
