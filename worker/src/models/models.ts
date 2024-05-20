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
