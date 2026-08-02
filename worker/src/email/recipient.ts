import { getEnvStringList, getMailDomain, getSplitStringListValue, normalizeAddressDomain, normalizeDomains } from "../utils";

const RECIPIENT_HEADERS = ["To", "Delivered-To", "X-Forwarded-To"];

const getAllowDomains = (env?: Bindings): string[] => {
    const value = env?.REAL_RECIPIENT_DOMAINS;
    const domains = typeof value === "string" && !value.trim().startsWith("[")
        ? getSplitStringListValue(value)
        : getEnvStringList(value);
    return normalizeDomains(domains);
}

const extractAddresses = (headerValue: string): string[] => {
    return headerValue
        .split(",")
        .map((part) => {
            const start = part.lastIndexOf("<");
            const end = part.lastIndexOf(">");
            const value = start >= 0 && end > start
                ? part.slice(start + 1, end)
                : part;
            return normalizeAddressDomain(value);
        })
        .filter((address) => address.includes("@") && !address.includes(" "));
}

/**
 * Resolve the original recipient of a forwarded email.
 * message.to is only the last hop of the forward chain (the SMTP envelope
 * recipient), the real recipient is kept in the mail headers.
 * Returns fallback if nothing usable is found.
 */
export function resolveRealRecipient(
    message: ForwardableEmailMessage,
    fallback: string,
    env?: Bindings
): string {
    try {
        const allowDomains = getAllowDomains(env);
        for (const header of RECIPIENT_HEADERS) {
            const headerValue = message.headers.get(header);
            if (!headerValue) continue;
            for (const address of extractAddresses(headerValue)) {
                if (allowDomains.length === 0
                    || allowDomains.includes(getMailDomain(address))) {
                    return address;
                }
            }
        }
    } catch (error) {
        console.error("resolve real recipient error", error);
    }
    return fallback;
}
