export type UserRole = {
    domains: string[] | undefined | null,
    role: string,
    prefix: string | undefined | null
}

export type Bindings = {
    // bindings
    DB: D1Database
    KV: KVNamespace
    RATE_LIMITER: any
    SEND_MAIL: any

    // config
    TITLE: string | undefined
    ANNOUNCEMENT: string | undefined | null
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
    ENABLE_USER_DELETE_EMAIL: string | boolean | undefined
    ENABLE_INDEX_ABOUT: string | boolean | undefined
    DEFAULT_SEND_BALANCE: number | string | undefined
    NO_LIMIT_SEND_ROLE: string | undefined | null
    ADMIN_CONTACT: string | undefined
    COPYRIGHT: string | undefined
    DISABLE_SHOW_GITHUB: string | boolean | undefined
    FORWARD_ADDRESS_LIST: string | string[] | undefined

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
    [key: `RESEND_TOKEN_${string}`]: string | undefined;

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
}

type HonoCustomType = {
    "Bindings": Bindings;
    "Variables": Variables;
}
