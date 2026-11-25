type AuthenticationResult = {
    method: string,
    result: string,
    version?: string,
}

const supportedResults: Record<string, ReadonlySet<string>> = {
    spf: new Set(["none", "neutral", "pass", "fail", "softfail", "policy", "temperror", "permerror"]),
    dkim: new Set(["none", "neutral", "pass", "fail", "policy", "temperror", "permerror"]),
    dmarc: new Set(["none", "pass", "fail", "temperror", "permerror"]),
};
const receivedSpfResults = new Set([
    "none", "neutral", "pass", "fail", "softfail", "temperror", "permerror",
]);

const parseAuthenticationResults = (value: string): AuthenticationResult[] => {
    const results: AuthenticationResult[] = [];
    const pattern = /(?:^|;)[ \t]*([a-z][a-z0-9_-]*)(?:[ \t]*\/[ \t]*(\d+))?[ \t]*=[ \t]*([a-z][a-z0-9_-]*)/gi;

    for (const match of value.matchAll(pattern)) {
        results.push({
            method: match[1].toLowerCase(),
            version: match[2],
            result: match[3].toLowerCase(),
        });
    }
    return results;
}

const normalizeCheckName = (value: string): string => value.trim().toLowerCase();

const trackAuthenticationResult = (
    method: string,
    result: string | undefined,
    existing: Set<string>,
    passed: Set<string>,
) => {
    if (!result || !supportedResults[method]?.has(result)) return;

    // SPF and DKIM neutral are absent-equivalent under RFC 7208 and RFC 8601.
    if (result === "none" || ((method === "spf" || method === "dkim") && result === "neutral")) return;

    existing.add(method);
    if (result === "pass") {
        passed.add(method);
    }
}

export const isJunkMailByHeaders = (
    headers: Record<string, string>[],
    checkListWhenExist: string[],
    forcePassList: string[],
): boolean => {
    const passed = new Set<string>();
    const existing = new Set<string>();

    for (const header of headers) {
        const key = header["key"]?.toLowerCase();
        const value = header["value"];
        if (!key || !value) continue;

        if (key === "received-spf") {
            const result = value.match(/^[ \t]*([a-z][a-z0-9_-]*)/i)?.[1]?.toLowerCase();
            if (!result || !receivedSpfResults.has(result)) continue;
            trackAuthenticationResult("spf", result, existing, passed);
            continue;
        }

        if (key !== "authentication-results") continue;

        for (const { method, result, version } of parseAuthenticationResults(value)) {
            if (method !== "spf" && method !== "dkim" && method !== "dmarc") continue;
            if (version && version !== "1") continue;
            trackAuthenticationResult(method, result, existing, passed);
        }
    }

    if (checkListWhenExist.some((checkName) => {
        const normalizedName = normalizeCheckName(checkName);
        return existing.has(normalizedName) && !passed.has(normalizedName);
    })) {
        return true;
    }

    return forcePassList.some(
        (checkName) => !passed.has(normalizeCheckName(checkName))
    );
}
