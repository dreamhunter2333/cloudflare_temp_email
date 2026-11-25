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
