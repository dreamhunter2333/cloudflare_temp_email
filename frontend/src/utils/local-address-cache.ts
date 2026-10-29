export const decodeAddressToken = (token: string) => {
    try {
        const bytes = Uint8Array.from(atob(
            token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'),
        ), char => char.charCodeAt(0));
        const payload = JSON.parse(new TextDecoder().decode(bytes));
        return typeof payload?.address === 'string' ? payload : null;
    } catch {
        return null;
    }
};

export const updateLocalAddressCache = (
    cache: string[], token: string,
    { address, type, new_address_token }: {
        address: string; type?: 'address_password_login'; new_address_token?: string | null;
    },
) => {
    const updatedToken = new_address_token || token;
    const matches = (cachedToken: string) => {
        const payload = decodeAddressToken(cachedToken);
        return cachedToken === token || cachedToken === updatedToken
            || (payload?.address === address && payload.type === type);
    };
    const existingIndex = cache.findIndex(matches);
    const remaining = cache.filter(cachedToken => !matches(cachedToken));
    remaining.splice(existingIndex < 0 ? remaining.length : existingIndex, 0, updatedToken);
    return remaining;
};
