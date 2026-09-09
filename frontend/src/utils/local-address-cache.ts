export type CachedAddress = {
    token: string;
    address?: string;
    type?: 'address_password_login' | null;
};

export const getCachedAddresses = (cache: (string | CachedAddress)[]): CachedAddress[] => cache
    .map(entry => typeof entry === 'string' ? { token: entry } : entry)
    .filter(entry => typeof entry?.token === 'string' && entry.token);

export const updateLocalAddressCache = (
    cache: (string | CachedAddress)[], token: string,
    { address, type }: { address: string; type?: 'address_password_login' },
) => {
    const entries = getCachedAddresses(cache);
    const loginType = type ?? null;
    const existing = entries.find(entry => entry.token === token
        || (entry.address === address && entry.type === loginType));
    const updated = { token, address, type: loginType };
    if (!existing) return [...entries, updated];
    return entries.flatMap(entry => {
        if (entry === existing) return [updated];
        if (entry.token === token || (entry.address === address && entry.type === loginType)) return [];
        return [entry];
    });
};
