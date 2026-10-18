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
    { address, type, new_address_token }: {
        address: string; type?: 'address_password_login'; new_address_token?: string | null;
    },
) => {
    const entries = getCachedAddresses(cache);
    const updated = { token: new_address_token || token, address, type: type ?? null };
    const matches = (entry: CachedAddress) => entry.token === token || entry.token === updated.token
        || (entry.address === address && entry.type === updated.type);
    const existingIndex = entries.findIndex(matches);
    const remaining = entries.filter(entry => !matches(entry));
    remaining.splice(existingIndex < 0 ? remaining.length : existingIndex, 0, updated);
    return remaining;
};
