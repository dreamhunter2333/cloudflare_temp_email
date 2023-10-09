import { useGlobalState } from '../store'

const API_BASE = import.meta.env.VITE_API_BASE || "";
const { loading, auth, jwt, openSettings, showAuth, adminAuth, showAdminAuth } = useGlobalState();

const apiFetch = async (path, options = {}) => {
    loading.value = true;
    try {
        const response = await fetch(`${API_BASE}${path}`, {
            method: options.method || 'GET',
            headers: {
                'x-custom-auth': auth.value,
                'x-admin-auth': adminAuth.value,
                'Authorization': `Bearer ${jwt.value}`,
                'Content-Type': 'application/json',
            },
        });
        if (response.status === 401 && openSettings.value.auth) {
            showAuth.value = true;
            throw new Error("Unauthorized");
        }
        if (response.status === 401 && path.startsWith("/admin")) {
            showAdminAuth.value = true;
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
            needAuth: res["needAuth"] || false,
            domains: res["domains"].map((domain) => {
                return {
                    label: domain,
                    value: domain
                }
            })
        };
        if (openSettings.value.needAuth) {
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

const adminShowPassword = async (id) => {
    try {
        const { password } = await apiFetch(`/admin/show_password/${id}`);
        return password;
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

const adminGetAddress = async () => {
    try {
        return await apiFetch("/admin/addresss");
    } catch (error) {
        throw error;
    }
}


export const api = {
    fetch: apiFetch,
    getSettings: getSettings,
    getOpenSettings: getOpenSettings,
    adminShowPassword: adminShowPassword,
    adminDeleteAddress: adminDeleteAddress,
    adminGetAddress: adminGetAddress,
}
