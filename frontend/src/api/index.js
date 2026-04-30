import { useGlobalState } from '../store'
import { h } from 'vue'
import axios from 'axios'

import i18n from '../i18n'
import { getFingerprint } from '../utils/fingerprint'
import { safeBearerHeader, safeHeaderValue } from '../utils/headers'

const API_BASE = import.meta.env.VITE_API_BASE || "";
const {
    loading, auth, jwt, settings, openSettings,
    userOpenSettings, userSettings, announcement,
    showAuth, adminAuth, showAdminAuth, userJwt
} = useGlobalState();

const instance = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    validateStatus: (status) => status >= 200 && status <= 500
});

const apiFetch = async (path, options = {}) => {
    loading.value = true;
    try {
        // Get browser fingerprint for request tracking
        const fingerprint = await getFingerprint();

        // Skip auth headers whose value is empty / "undefined" / contains
        // control chars (otherwise axios throws "Invalid character in header
        // content" before the request is sent — see issue #1000).
        const headers = {
            'x-lang': i18n.global.locale.value,
            'x-fingerprint': fingerprint,
            'Content-Type': 'application/json',
        };
        const userTokenHeader = safeHeaderValue(options.userJwt || userJwt.value);
        if (userTokenHeader) headers['x-user-token'] = userTokenHeader;
        const userAccessHeader = safeHeaderValue(userSettings.value.access_token);
        if (userAccessHeader) headers['x-user-access-token'] = userAccessHeader;
        const customAuthHeader = safeHeaderValue(auth.value);
        if (customAuthHeader) headers['x-custom-auth'] = customAuthHeader;
        const adminAuthHeader = safeHeaderValue(adminAuth.value);
        if (adminAuthHeader) headers['x-admin-auth'] = adminAuthHeader;
        const authorizationHeader = safeBearerHeader(jwt.value);
        if (authorizationHeader) headers['Authorization'] = authorizationHeader;

        const response = await instance.request(path, {
            method: options.method || 'GET',
            data: options.body || null,
            headers,
        });
        if (response.status === 401 && path.startsWith("/admin")) {
            showAdminAuth.value = true;
        }
        if (response.status === 401 && openSettings.value.needAuth) {
            showAuth.value = true;
        }
        if (response.status >= 300) {
            throw new Error(`[${response.status}]: ${response.data}` || "error");
        }
        const data = response.data;
        return data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Code ${error.response.status}: ${error.response.data}` || "error");
        }
        throw error;
    } finally {
        loading.value = false;
    }
}

const getOpenSettings = async (message, notification) => {
    try {
        const res = await api.fetch("/open_api/settings");
        const domains = Array.isArray(res["domains"]) ? res["domains"] : [];
        const domainLabels = res["domainLabels"] || [];
        if (domains.length < 1) {
            message.error("No domains found, please check your worker settings");
        }
        Object.assign(openSettings.value, {
            ...res,
            title: res["title"] || "",
            prefix: res["prefix"] || "",
            minAddressLen: res["minAddressLen"] || 1,
            maxAddressLen: res["maxAddressLen"] || 30,
            needAuth: res["needAuth"] || false,
            defaultDomains: res["defaultDomains"] || [],
            randomSubdomainDomains: res["randomSubdomainDomains"] || [],
            domains: domains.map((domain, index) => {
                return {
                    label: domainLabels.length > index ? domainLabels[index] : domain,
                    value: domain
                }
            }),
            adminContact: res["adminContact"] || "",
            enableUserCreateEmail: res["enableUserCreateEmail"] || false,
            disableAnonymousUserCreateEmail: res["disableAnonymousUserCreateEmail"] || false,
            disableCustomAddressName: res["disableCustomAddressName"] || false,
            enableUserDeleteEmail: res["enableUserDeleteEmail"] || false,
            enableAutoReply: res["enableAutoReply"] || false,
            enableIndexAbout: res["enableIndexAbout"] || false,
            copyright: res["copyright"] || openSettings.value.copyright,
            cfTurnstileSiteKey: res["cfTurnstileSiteKey"] || "",
            enableWebhook: res["enableWebhook"] || false,
            isS3Enabled: res["isS3Enabled"] || false,
            enableAddressPassword: res["enableAddressPassword"] || false,
            enableAgentEmailInfo: res["enableAgentEmailInfo"] || false,
            smtpImapProxyConfig: res["smtpImapProxyConfig"] || openSettings.value.smtpImapProxyConfig,
            statusUrl: res["statusUrl"] || "",
            enableGlobalTurnstileCheck: res["enableGlobalTurnstileCheck"] || false,
        });
        if (openSettings.value.needAuth) {
            showAuth.value = true;
        }
        if (openSettings.value.announcement
            && !openSettings.value.fetched
            && (openSettings.value.announcement != announcement.value
                || openSettings.value.alwaysShowAnnouncement)
        ) {
            announcement.value = openSettings.value.announcement;
            notification.info({
                content: () => {
                    return h("div", {
                        innerHTML: announcement.value
                    });
                }
            });
        }
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        openSettings.value.fetched = true;
    }
}

const getSettings = async () => {
    try {
        if (typeof jwt.value != 'string' || jwt.value.trim() === '' || jwt.value === 'undefined') {
            return "";
        }
        const res = await apiFetch("/api/settings");;
        settings.value = {
            address: res["address"],
            auto_reply: res["auto_reply"],
            send_balance: res["send_balance"],
        };
    } finally {
        settings.value.fetched = true;
    }
}


const getUserOpenSettings = async (message) => {
    try {
        const res = await api.fetch(`/user_api/open_settings`);
        Object.assign(userOpenSettings.value, res);
    } catch (error) {
        message.error(error.message || "fetch settings failed");
    } finally {
        userOpenSettings.value.fetched = true;
    }
}

const getUserSettings = async (message) => {
    try {
        if (!userJwt.value) return;
        const res = await api.fetch("/user_api/settings")
        Object.assign(userSettings.value, res)
        // auto refresh user jwt
        if (userSettings.value.new_user_token) {
            try {
                await api.fetch("/user_api/settings", {
                    userJwt: userSettings.value.new_user_token,
                })
                userJwt.value = userSettings.value.new_user_token;
                console.log("User JWT updated successfully");
            }
            catch (error) {
                console.error("Failed to update user JWT", error);
            }
        }
    } catch (error) {
        message?.error(error.message || "error");
    } finally {
        userSettings.value.fetched = true;
    }
}

const adminShowAddressCredential = async (id) => {
    try {
        const { jwt: addressCredential } = await apiFetch(`/admin/show_password/${id}`);
        return addressCredential;
    } catch (error) {
        throw error;
    }
}

const adminDeleteAddress = async (id) => {
    try {
        await apiFetch(`/admin/delete_address/${id}`, {
            method: 'DELETE'
        });
    } catch (error) {
        throw error;
    }
}

const bindUserAddress = async () => {
    if (!userJwt.value) return;
    try {
        await apiFetch(`/user_api/bind_address`, {
            method: 'POST',
        });
    } catch (error) {
        throw error;
    }
}

export const api = {
    fetch: apiFetch,
    getSettings,
    getOpenSettings,
    getUserOpenSettings,
    getUserSettings,
    adminShowAddressCredential,
    adminDeleteAddress,
    bindUserAddress,
}
