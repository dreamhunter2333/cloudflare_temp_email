export class UserSettings {
    /** @param {UserSettings|undefined|null} data */
    constructor(data) {
        if (data === null) {
            return;
        }
        const {
            enable, enableMailVerify, verifyMailSender,
            enableMailAllowList, mailAllowList, maxAddressCount
        } = data || {};
        /** @type {boolean|undefined} */
        this.enable = enable;
        /** @type {boolean|undefined} */
        this.enableMailVerify = enableMailVerify;
        /** @type {string|undefined} */
        this.verifyMailSender = verifyMailSender;
        /** @type {boolean|undefined} */
        this.enableMailAllowList = enableMailAllowList;
        /** @type {Array<string>|undefined} */
        this.mailAllowList = mailAllowList;
        /** @type {number|undefined} */
        this.maxAddressCount = maxAddressCount || 5;
    }
}

export class CleanupSettings {
    /** @param {CleanupSettings|undefined|null} data */
    constructor(data) {
        const {
            enableMailsAutoCleanup, cleanMailsDays,
            enableUnknowMailsAutoCleanup, cleanUnknowMailsDays,
            enableAddressAutoCleanup, cleanAddressDays,
            enableSendBoxAutoCleanup, cleanSendBoxDays
        } = data || {};
        /** @type {boolean|undefined} */
        this.enableMailsAutoCleanup = enableMailsAutoCleanup;
        /** @type {number|undefined} */
        this.cleanMailsDays = cleanMailsDays;
        /** @type {boolean|undefined} */
        this.enableUnknowMailsAutoCleanup = enableUnknowMailsAutoCleanup;
        /** @type {number|undefined} */
        this.cleanUnknowMailsDays = cleanUnknowMailsDays;
        /** @type {boolean|undefined} */
        this.enableAddressAutoCleanup = enableAddressAutoCleanup;
        /** @type {number|undefined} */
        this.cleanAddressDays = cleanAddressDays;
        /** @type {boolean|undefined} */
        this.enableSendBoxAutoCleanup = enableSendBoxAutoCleanup;
        /** @type {number|undefined} */
        this.cleanSendBoxDays = cleanSendBoxDays;
    }
}

export class GeoData {
    /** @param {string} ip @param {GeoData|undefined|null} data */
    constructor(ip, data) {
        const {
            country, city, timezone, postalCode, region,
            latitude, longitude, regionCode, asOrganization
        } = data || {};
        /** @type {string} */
        this.ip = ip;
        /** @type {string|undefined} */
        this.country = country;
        /** @type {string|undefined} */
        this.city = city;
        /** @type {string|undefined} */
        this.timezone = timezone;
        /** @type {string|undefined} */
        this.postalCode = postalCode;
        /** @type {string|undefined} */
        this.region = region;
        /** @type {number|undefined} */
        this.latitude = latitude;
        /** @type {number|undefined} */
        this.longitude = longitude;
        /** @type {string|undefined} */
        this.regionCode = regionCode;
        /** @type {string|undefined} */
        this.asOrganization = asOrganization;
    }
}

export class UserInfo {
    /** @param {GeoData} geoData @param {string} userEmail */
    constructor(geoData, userEmail) {
        /** @type {geoData} */
        this.geoData = geoData;
        /** @type {string} */
        this.userEmail = userEmail;
    }
}
