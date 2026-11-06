import type { Context } from 'hono'

const pending = new Map<string, Promise<unknown>>();

export const getStatisticsSnapshot = async <T>(
    c: Context<HonoCustomType>, key: string, load: () => Promise<T>
): Promise<T> => {
    const cacheKey = new Request(new URL(`/__admin_statistics_v6/${encodeURIComponent(key)}`, c.req.url));
    const running = pending.get(cacheKey.url);
    if (running) return running as Promise<T>;
    const promise = (async () => {
        try {
            const response = await caches.default.match(cacheKey);
            if (response) return await response.json<T>();
        } catch (error) {
            console.warn('Failed to read statistics cache', error);
        }
        const value = await load();
        try {
            await caches.default.put(cacheKey, new Response(JSON.stringify(value), {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
            }));
        } catch (error) {
            console.warn('Failed to cache statistics', error);
        }
        return value;
    })();
    pending.set(cacheKey.url, promise);
    try {
        return await promise;
    } finally {
        pending.delete(cacheKey.url);
    }
};
