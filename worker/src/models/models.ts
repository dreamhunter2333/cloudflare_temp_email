export class AdminWebhookSettings {
    allowList: string[];

    constructor(allowList: string[]) {
        this.allowList = allowList;
    }
}

export type WebhookMail = {
    from: string;
    to: string;
    headers: string;
    subject: string;
    raw: string;
    parsedText: string;
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
