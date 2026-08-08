<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useScopedI18n } from '@/i18n/app'
import { useMessage } from 'naive-ui'
import useClipboard from 'vue-clipboard3'
import { Copy } from '@vicons/fa'

import { useGlobalState } from '../store'
import { api } from '../api'

const props = defineProps({
    showCopy: {
        type: Boolean,
        default: true,
    },
    size: {
        type: String,
        default: 'small',
    },
})

const message = useMessage()
const { toClipboard } = useClipboard()

const {
    jwt, settings, userJwt, isTelegram, openSettings, telegramApp
} = useGlobalState()

const { t } = useScopedI18n('components.AddressSelect')

const addressOptions = ref([])
const addressValue = ref(null)
const addressLoading = ref(false)
const localAddressCache = useLocalStorage("LocalAddressCache", [])
const optionValueMap = new Map()
let addressSearchTimer = null
let addressRequestId = 0

const formatAddressLabel = (address) => {
    if (!address) return address;
    const domain = address.split('@')[1]
    const domainLabel = openSettings.value.domains.find(
        d => d.value === domain
    )?.label;
    if (!domainLabel) return address;
    return address.replace('@' + domain, `@${domainLabel}`);
}

const parseJwtAddress = (curJwt) => {
    try {
        const payload = JSON.parse(
            decodeURIComponent(
                atob(curJwt.split(".")[1]
                    .replace(/-/g, "+").replace(/_/g, "/")
                )
            )
        );
        return payload.address;
    } catch (e) {
        return null;
    }
}

const getOptionValue = (key, scope, payload, address) => {
    if (optionValueMap.has(key)) {
        const cached = optionValueMap.get(key)
        cached.scope = scope
        cached.payload = payload
        cached.address = address
        return cached
    }
    const value = { key, scope, payload, address }
    optionValueMap.set(key, value)
    return value
}

const buildLocalOptions = (excludeAddresses = new Set(), query = '') => {
    const normalizedQuery = query.trim().toLowerCase();
    if (typeof jwt.value === 'string' && jwt.value && !localAddressCache.value.includes(jwt.value)) {
        localAddressCache.value.push(jwt.value)
    }
    const children = localAddressCache.value
        .map((curJwt) => {
            const address = parseJwtAddress(curJwt);
            if (!address) return null;
            if (excludeAddresses.has(address)) return null;
            if (normalizedQuery && !address.toLowerCase().includes(normalizedQuery)) return null;
            const label = formatAddressLabel(address);
            const key = `local:${curJwt}`;
            const option = { label, value: getOptionValue(key, 'local', curJwt, address), address };
            return option;
        })
        .filter(Boolean);
    return children;
}

const fetchUserAddressRows = async (query = '') => {
    const params = new URLSearchParams({
        limit: '100',
        offset: '0',
        with_counts: 'false',
        with_total: 'false',
    });
    if (query) {
        params.set('query', query);
    }
    const { results } = await api.fetch(`/user_api/bind_address?${params.toString()}`);
    return results || [];
}

const buildUserOptions = async (query = '') => {
    const children = [];
    try {
        const rows = await fetchUserAddressRows(query);
        if (!query && settings.value.address && !rows.some((row) => row.name === settings.value.address)) {
            const currentRows = await fetchUserAddressRows(settings.value.address);
            const currentRow = currentRows.find((row) => row.name === settings.value.address);
            if (currentRow) {
                rows.push(currentRow);
            }
        }
        for (const row of rows) {
            const address = row.address || row.name;
            if (!address) continue;
            const label = formatAddressLabel(address);
            const key = `user:${row.id}`;
            const option = { label, value: getOptionValue(key, 'user', String(row.id), address), address };
            children.push(option);
        }
    } catch (error) {
        message.error(error.message || "error");
    }
    return children;
}

const buildTelegramOptions = async () => {
    const children = [];
    try {
        const data = await api.fetch(`/telegram/get_bind_address`, {
            method: 'POST',
            body: JSON.stringify({
                initData: telegramApp.value.initData
            })
        });
        for (const row of data || []) {
            if (!row?.address || !row?.jwt) continue;
            const label = formatAddressLabel(row.address);
            const key = `tg:${row.jwt}`;
            const option = { label, value: getOptionValue(key, 'tg', row.jwt, row.address), address: row.address };
            children.push(option);
        }
    } catch (error) {
        message.error(error.message || "error");
    }
    return children;
}

const refreshAddressOptions = async (query = '') => {
    const requestId = ++addressRequestId;
    addressLoading.value = true;
    try {
        if (isTelegram.value) {
            const telegramChildren = await buildTelegramOptions();
            if (requestId !== addressRequestId) return;
            addressOptions.value = telegramChildren;
            const currentOption = telegramChildren.find(
                (item) => item.address === settings.value.address
            );
            if (currentOption) addressValue.value = currentOption.value;
            return;
        }
        const groups = [];
        if (userJwt.value) {
            const userChildren = await buildUserOptions(query);
            if (userChildren.length > 0) {
                groups.push({ type: 'group', label: t('userAddresses'), children: userChildren });
            }
            const userAddressSet = new Set(userChildren.map((item) => item.address));
            const localChildren = buildLocalOptions(userAddressSet, query);
            if (localChildren.length > 0) {
                groups.push({ type: 'group', label: t('localAddresses'), children: localChildren });
            }
        } else {
            const localChildren = buildLocalOptions();
            if (localChildren.length > 0) {
                groups.push({ type: 'group', label: t('localAddresses'), children: localChildren });
            }
        }
        if (requestId !== addressRequestId) return;
        addressOptions.value = groups;
        const currentOption = groups
            .flatMap((group) => group.children || [])
            .find((item) => item.address === settings.value.address);
        if (currentOption) addressValue.value = currentOption.value;
    } finally {
        if (requestId === addressRequestId) {
            addressLoading.value = false;
        }
    }
}

const searchUserAddresses = (query) => {
    if (!userJwt.value || isTelegram.value) return;
    clearTimeout(addressSearchTimer);
    addressSearchTimer = setTimeout(() => {
        refreshAddressOptions(query.trim());
    }, 250);
}

const onAddressChange = async (value) => {
    if (!value) return;
    if (value.scope === 'local' || value.scope === 'tg') {
        jwt.value = value.payload;
        location.reload();
        return;
    }
    if (value.scope === 'user') {
        try {
            const res = await api.fetch(`/user_api/bind_address_jwt/${value.payload}`);
            if (!res?.jwt) {
                message.error("jwt not found");
                return;
            }
            jwt.value = res.jwt;
            location.reload();
        } catch (error) {
            message.error(error.message || "error");
        }
    }
}

const copy = async () => {
    try {
        await toClipboard(settings.value.address)
        message.success(t('copied'));
    } catch (e) {
        message.error(e.message || "error");
    }
}

onMounted(async () => {
    await refreshAddressOptions();
});

watch([userJwt, isTelegram, () => settings.value.address], async () => {
    await refreshAddressOptions();
});

onBeforeUnmount(() => {
    clearTimeout(addressSearchTimer);
    addressRequestId++;
})
</script>

<template>
    <n-flex class="address-row" align="center" justify="center" :wrap="true">
        <n-select v-model:value="addressValue" :options="addressOptions" :size="size" filterable
            :remote="Boolean(userJwt) && !isTelegram"
            :loading="addressLoading" :placeholder="t('address')" @update:value="onAddressChange"
            @search="searchUserAddresses"
            class="address-select" />
        <slot name="actions" />
        <n-button v-if="showCopy" class="address-copy" @click="copy" :size="size" tertiary type="primary">
            <n-icon :component="Copy" /> {{ t('copy') }}
        </n-button>
    </n-flex>
</template>

<style scoped>
.address-row {
    width: 100%;
    gap: 10px;
}

.address-select {
    min-width: 220px;
    max-width: 420px;
    flex: 1 1 220px;
}

.address-copy {
    flex: 0 0 auto;
    white-space: nowrap;
}
</style>
