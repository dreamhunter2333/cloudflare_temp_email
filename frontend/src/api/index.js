import { useGlobalState } from '../store'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || "";
const { loading, auth, jwt, settings, openSettings } = useGlobalState();
const { showAuth, adminAuth, showAdminAuth } = useGlobalState();

const instance = axios.create({
    baseURL: API_BASE,
    timeout: 10000
});

const apiFetch = async (path, options = {}) => {
    loading.value = true;
    try {
        const response = await instance.request(path, {
            method: options.method || 'GET',
            data: options.body || null,
            headers: {
                'x-custom-auth': auth.value,
                'x-admin-auth': adminAuth.value,
                'Authorization': `Bearer ${jwt.value}`,
                'Content-Type': 'application/json',
            },
        });
        if (response.status === 401 && openSettings.value.auth) {
            showAuth.value = true;
            throw new Error("Unauthorized, you password is wrong")
        }
        if (response.status === 401 && path.startsWith("/admin")) {
            showAdminAuth.value = true;
            throw new Error("Unauthorized, you admin password is wrong")
        }
        if (response.status >= 300) {
            throw new Error(`${response.status} ${response.data}` || "error");
        }
        const data = response.data;
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
    const res = await apiFetch("/api/settings");;
    settings.value = {
        address: res["address"],
        auto_reply: res["auto_reply"]
    };
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

export const api = {
    fetch: apiFetch,
    getSettings: getSettings,
    getOpenSettings: getOpenSettings,
    adminShowPassword: adminShowPassword,
    adminDeleteAddress: adminDeleteAddress,
}
