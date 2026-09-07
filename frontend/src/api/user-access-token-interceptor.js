import { AxiosHeaders } from 'axios';
import { useGlobalState } from '../store';
import { safeBearerHeader, safeHeaderValue } from '../utils/headers';
import { ErrorCode } from './error-codes';

const { userJwt, userSettings, jwt } = useGlobalState();
const mailboxPaths = new Set(['/api/settings', '/api/send_mail']);
const paths = ['/admin/', ...mailboxPaths, '/user_api/bind_address', '/user_api/address/'];
const getPathname = (url) => new URL(url, window.location.origin).pathname;

export const isUserAccessTokenError = (response) => response.status === 401
    && response.data?.code === ErrorCode.AUTH_USER_ACCESS_TOKEN_EXPIRED;

const isCurrentSession = ({ headers }) =>
    safeHeaderValue(headers.get('x-user-token')) === safeHeaderValue(userJwt.value)
    && safeHeaderValue(headers.get('Authorization')) === safeBearerHeader(jwt.value);

const matches = (path, response) => {
    if (!isUserAccessTokenError(response)) return false;
    const pathname = getPathname(path);
    if (!paths.some(prefix => pathname.startsWith(prefix))) return false;
    const { config } = response;
    if (!isCurrentSession(config)) return false;
    if (!safeHeaderValue(config.headers.get('x-user-access-token'))) return false;

    const token = safeHeaderValue(config.headers.get('x-user-token'));
    return Boolean(token) || mailboxPaths.has(pathname);
};

async function loadUserSettings(token, client, headers) {
    const response = await client.get('/user_api/settings', { headers });
    if (response.status >= 300) {
        throw new Error(`[${response.status}]: ${response.data?.message || response.data}`);
    }
    if (safeHeaderValue(userJwt.value) === token) {
        Object.assign(userSettings.value, response.data);
    }
}

export const createUserAccessTokenInterceptor = (client) => {
    const pendingRefreshes = new Map();

    async function refreshUserSettings(token, headers) {
        if (pendingRefreshes.has(token)) return await pendingRefreshes.get(token);
        const request = loadUserSettings(token, client, headers);
        pendingRefreshes.set(token, request);
        try {
            await request;
        } finally {
            pendingRefreshes.delete(token);
        }
    }

    async function resolveAccessToken(config) {
        const token = safeHeaderValue(config.headers.get('x-user-token'));
        if (!token) return;
        const currentToken = safeHeaderValue(userSettings.value.access_token);
        if (currentToken !== safeHeaderValue(config.headers.get('x-user-access-token'))) return currentToken;

        try {
            await refreshUserSettings(token, config.headers);
        } catch (error) {
            if (!mailboxPaths.has(getPathname(config.url))) throw error;
            return;
        }
        return safeHeaderValue(userSettings.value.access_token);
    }

    return {
        matches,
        handle: async ({ config }) => {
            const accessToken = await resolveAccessToken(config);
            if (!isCurrentSession(config)) throw new Error('User session changed, please retry');
            const headers = new AxiosHeaders(config.headers);
            headers.delete('x-user-access-token');
            if (accessToken) headers.set('x-user-access-token', accessToken);
            return await client.request({ ...config, headers });
        },
    };
};
