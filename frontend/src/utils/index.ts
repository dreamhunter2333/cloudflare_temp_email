export const hashPassword = async (password: string) => {
    // user crypto to hash password
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export const getRouterPathWithLang = (path: string, lang: string) => {
    if (!lang || lang === 'zh') {
        return path;
    }
    return `/${lang}${path}`;
}

export const utcToLocalDate = (utcDate: string, useUTCDate: boolean) => {
    const utcDateString = `${utcDate} UTC`;
    if (useUTCDate) {
        return utcDateString;
    }
    try {
        const date = new Date(utcDateString);
        // if invalid date string
        if (isNaN(date.getTime())) return utcDateString;

        return date.toLocaleString();
    } catch (e) {
        console.error(e);
    }
    return utcDateString;
}
