export type AiExtractSettings = {
    enableAllowList: boolean;
    allowList: string[];
};

export function isAddressInAiAllowlist(settings: AiExtractSettings | null | undefined, address: string): boolean {
    if (!settings?.enableAllowList) return true;
    if (!Array.isArray(settings.allowList) || settings.allowList.length === 0) return false;

    return settings.allowList.some(pattern => {
        if (typeof pattern !== 'string') return false;
        if (!pattern.includes('*')) return address === pattern;
        const escapedPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
        return new RegExp('^' + escapedPattern + '$').test(address);
    });
}
