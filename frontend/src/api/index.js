import { useGlobalState } from '../store'

const API_BASE = import.meta.env.VITE_API_BASE || "";
const { loading, auth, jwt, openSettings, showAuth } = useGlobalState();

const apiFetch = async (path, options = {}) => {
    loading.value = true;
    try {
        const response = await fetch(`${API_BASE}${path}`, {
            method: options.method || 'GET',
            headers: {
                'x-custom-auth': auth.value,
                'Authorization': `Bearer ${jwt.value}`,
                'Content-Type': 'application/json',
            },
        });
        if (response.status === 401 && openSettings.value.auth) {
            showAuth.value = true;
            throw new Error("Unauthorized");
        }
        if (!response.ok) {
            throw new Error(`${response.status} ${await response.text()}` || "error");
        }
        const data = await response.json();
        return data;
    } finally {
        loading.value = false;
    }
}

const getOpenSettings = async (message) => {
    try {
        const res = await api.fetch("/open_api/settings");
        openSettings.value = {
            prefix: res["prefix"] || "",
            auth: res["auth"] || false,
            domains: res["domains"].map((domain) => {
                return {
                    label: domain,
                    value: domain
                }
            })
        };
        if (openSettings.value.auth && !auth.value) {
            showAuth.value = true;
        }
    } catch (error) {
        message.error(error.message || "error");
    }
}

const getSettings = async () => {
    if (typeof jwt.value != 'string' || jwt.value.trim() === '' || jwt.value === 'undefined') {
        return "";
    }
    loading.value = true;
    const res = await apiFetch("/api/settings");;
    return res["address"];
}


export const api = {
    fetch: apiFetch,
    getSettings: getSettings,
    getOpenSettings: getOpenSettings,
}
