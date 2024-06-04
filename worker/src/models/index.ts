export class AdminWebhookSettings {
    allowList: string[];

    constructor(allowList: string[]) {
        this.allowList = allowList;
    }
}

export type WebhookMail = {
    from: string;
    to: string;
    subject: string;
    raw: string;
    parsedText: string;
    parsedHtml: string;
}

export class CleanupSettings {

    enableMailsAutoCleanup: boolean | undefined;
    cleanMailsDays: number;
    enableUnknowMailsAutoCleanup: boolean | undefined;
    cleanUnknowMailsDays: number;
    enableSendBoxAutoCleanup: boolean | undefined;
    cleanSendBoxDays: number;

    constructor(data: CleanupSettings | undefined | null) {
        const {
            enableMailsAutoCleanup, cleanMailsDays,
            enableUnknowMailsAutoCleanup, cleanUnknowMailsDays,
            enableSendBoxAutoCleanup, cleanSendBoxDays
        } = data || {};
        this.enableMailsAutoCleanup = enableMailsAutoCleanup;
        this.cleanMailsDays = cleanMailsDays || 0;
        this.enableUnknowMailsAutoCleanup = enableUnknowMailsAutoCleanup;
        this.cleanUnknowMailsDays = cleanUnknowMailsDays || 0;
        this.enableSendBoxAutoCleanup = enableSendBoxAutoCleanup;
        this.cleanSendBoxDays = cleanSendBoxDays || 0;
    }
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

    constructor(data: UserSettings | undefined | null) {
        const {
            enable, enableMailVerify, verifyMailSender,
            enableMailAllowList, mailAllowList, maxAddressCount
        } = data || {};
        this.enable = enable;
        this.enableMailVerify = enableMailVerify;
        this.verifyMailSender = verifyMailSender;
        this.enableMailAllowList = enableMailAllowList;
        this.mailAllowList = mailAllowList;
        this.maxAddressCount = maxAddressCount || 5;
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
