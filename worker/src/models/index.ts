import type {
    AuthenticatorTransportFuture,
    CredentialDeviceType,
    Base64URLString,
} from '@simplewebauthn/types';

export type Passkey = {
    id: Base64URLString;
    publicKey: string;
    counter: number;
    deviceType: CredentialDeviceType;
    backedUp: boolean;
    transports?: AuthenticatorTransportFuture[];
};

export class AdminWebhookSettings {
    enableAllowList: boolean;
    allowList: string[];

    constructor(enableAllowList: boolean, allowList: string[]) {
        this.enableAllowList = enableAllowList;
        this.allowList = allowList;
    }
}

export type WebhookMail = {
    id: string;
    url?: string;
    from: string;
    to: string;
    subject: string;
    raw: string;
    parsedText: string;
    parsedHtml: string;
}

export type CustomSqlCleanup = {
    id: string;           // Unique identifier
    name: string;         // Cleanup task name
    sql: string;          // Custom SQL statement (DELETE only)
    enabled: boolean;     // Whether to enable auto cleanup
}

export type CleanupSettings = {

    enableMailsAutoCleanup: boolean | undefined;
    cleanMailsDays: number;
    enableUnknowMailsAutoCleanup: boolean | undefined;
    cleanUnknowMailsDays: number;
    enableSendBoxAutoCleanup: boolean | undefined;
    cleanSendBoxDays: number;
    enableAddressAutoCleanup: boolean | undefined;
    cleanAddressDays: number;
    enableInactiveAddressAutoCleanup: boolean | undefined;
    cleanInactiveAddressDays: number;
    enableUnboundAddressAutoCleanup: boolean | undefined;
    cleanUnboundAddressDays: number;
    enableEmptyAddressAutoCleanup: boolean | undefined;
    cleanEmptyAddressDays: number;
    customSqlCleanupList: CustomSqlCleanup[] | undefined;
}

export class GeoData {

    ip: string;
    country: string | undefined;
    city: string | undefined;
    timezone: string | undefined;
    postalCode: string | undefined;
    region: string | undefined;
    latitude: number | undefined;
    longitude: number | undefined;
    regionCode: string | undefined;
    asOrganization: string | undefined;

    constructor(ip: string | null, data: GeoData | undefined | null) {
        const {
            country, city, timezone, postalCode, region,
            latitude, longitude, regionCode, asOrganization
        } = data || {};
        this.ip = ip || "unknown";
        this.country = country;
        this.city = city;
        this.timezone = timezone;
        this.postalCode = postalCode;
        this.region = region;
        this.latitude = latitude;
        this.longitude = longitude;
        this.regionCode = regionCode;
        this.asOrganization = asOrganization;
    }
}

export class UserSettings {

    enable: boolean | undefined;
    enableMailVerify: boolean | undefined;
    verifyMailSender: string | undefined;
    enableMailAllowList: boolean | undefined;
    mailAllowList: string[] | undefined;
    maxAddressCount: number;
    enableEmailCheckRegex: boolean | undefined;
    emailCheckRegex: string | undefined;

    constructor(data: UserSettings | undefined | null) {
        const {
            enable, enableMailVerify, verifyMailSender,
            enableMailAllowList, mailAllowList, maxAddressCount,
            enableEmailCheckRegex, emailCheckRegex
        } = data || {};
        this.enable = enable;
        this.enableMailVerify = enableMailVerify;
        this.verifyMailSender = verifyMailSender;
        this.enableMailAllowList = enableMailAllowList;
        this.mailAllowList = mailAllowList;
        this.maxAddressCount = maxAddressCount || 5;
        this.enableEmailCheckRegex = enableEmailCheckRegex;
        this.emailCheckRegex = emailCheckRegex;
    }
}

export class UserInfo {

    geoData: GeoData;
    userEmail: string;

    constructor(geoData: GeoData, userEmail: string) {
        this.geoData = geoData;
        this.userEmail = userEmail;
    }
}

export class WebhookSettings {
    enabled: boolean = false
    url: string = ''
    method: string = 'POST'
    headers: string = JSON.stringify({
        "Content-Type": "application/json"
    }, null, 2)
    body: string = JSON.stringify({
        "id": "${id}",
        "url": "${url}",
        "from": "${from}",
        "to": "${to}",
        "subject": "${subject}",
        "raw": "${raw}",
        "parsedText": "${parsedText}",
        "parsedHtml": "${parsedHtml}",
    }, null, 2)
}

export type UserOauth2Settings = {
    name: string;
    icon?: string;                // SVG icon string for the provider
    clientID: string;
    clientSecret: string;
    authorizationURL: string;
    accessTokenURL: string;
    accessTokenFormat: string;
    userInfoURL: string;
    redirectURL: string;
    logoutURL?: string;
    userEmailKey: string;
    enableEmailFormat?: boolean;  // Enable email format transformation
    userEmailFormat?: string;     // Regex pattern to match email
    userEmailReplace?: string;    // Replacement template using $1, $2, etc.
    scope: string;
    enableMailAllowList?: boolean | undefined;
    mailAllowList?: string[] | undefined;
}

export type EmailRuleSettings = {
    blockReceiveUnknowAddressEmail: boolean;
    emailForwardingList: SubdomainForwardAddressList[]
}

export type RoleConfig = {
    maxAddressCount?: number;
    // future configs can be added here
}

export type RoleAddressConfig = Record<string, RoleConfig>;
