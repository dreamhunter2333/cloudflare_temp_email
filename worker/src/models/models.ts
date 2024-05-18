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
