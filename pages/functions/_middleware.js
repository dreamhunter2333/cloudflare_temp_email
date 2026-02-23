const API_PATHS = [
    "/api/",
    "/open_api/",
    "/user_api/",
    "/admin/",
    "/telegram/",
    "/external/",
];

export async function onRequest(context) {
    const reqPath = new URL(context.request.url).pathname;
    if (API_PATHS.map(path => reqPath.startsWith(path)).some(Boolean)) {
        return context.env.BACKEND.fetch(context.request);
    }
    return await context.next();
}
