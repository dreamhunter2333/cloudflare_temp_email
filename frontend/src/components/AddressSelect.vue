<script setup>
import { onMounted, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n({
    messages: {
        en: {
            userAddresses: 'User Addresses',
            localAddresses: 'Local Addresses',
            address: 'Address',
            copy: 'Copy',
            copied: 'Copied',
        },
        zh: {
            userAddresses: '用户地址',
            localAddresses: '本地地址',
            address: '地址',
            copy: '复制',
            copied: '已复制',
        }
    }
});

const addressOptions = ref([])
const addressValue = ref(null)
const addressLoading = ref(false)
const localAddressCache = useLocalStorage("LocalAddressCache", [])
const optionValueMap = new Map()

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

const buildLocalOptions = (excludeAddresses = new Set()) => {
    if (typeof jwt.value === 'string' && jwt.value && !localAddressCache.value.includes(jwt.value)) {
        localAddressCache.value.push(jwt.value)
    }
    const children = localAddressCache.value
        .map((curJwt) => {
            const address = parseJwtAddress(curJwt);
            if (!address) return null;
            if (excludeAddresses.has(address)) return null;
            const label = formatAddressLabel(address);
            const key = `local:${curJwt}`;
            const option = { label, value: getOptionValue(key, 'local', curJwt, address), address };
            if (settings.value.address && address === settings.value.address) {
                addressValue.value = option.value;
            }
            return option;
        })
        .filter(Boolean);
    return children;
}

const buildUserOptions = async () => {
    const children = [];
    try {
        const { results } = await api.fetch(`/user_api/bind_address`);
        for (const row of results || []) {
            const address = row.address || row.name;
            if (!address) continue;
            const label = formatAddressLabel(address);
            const key = `user:${row.id}`;
            const option = { label, value: getOptionValue(key, 'user', String(row.id), address), address };
            if (settings.value.address && address === settings.value.address) {
                addressValue.value = option.value;
            }
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
            if (settings.value.address && row.address === settings.value.address) {
                addressValue.value = option.value;
            }
            children.push(option);
        }
    } catch (error) {
        message.error(error.message || "error");
    }
    return children;
}

const refreshAddressOptions = async () => {
    addressLoading.value = true;
    addressValue.value = null;
    try {
        if (isTelegram.value) {
            const telegramChildren = await buildTelegramOptions();
            addressOptions.value = telegramChildren;
            return;
        }
        const groups = [];
        if (userJwt.value) {
            const userChildren = await buildUserOptions();
            if (userChildren.length > 0) {
                groups.push({ type: 'group', label: t('userAddresses'), children: userChildren });
            }
            const userAddressSet = new Set(userChildren.map((item) => item.address));
            const localChildren = buildLocalOptions(userAddressSet);
            if (localChildren.length > 0) {
                groups.push({ type: 'group', label: t('localAddresses'), children: localChildren });
            }
        } else {
            const localChildren = buildLocalOptions();
            if (localChildren.length > 0) {
                groups.push({ type: 'group', label: t('localAddresses'), children: localChildren });
            }
        }
        addressOptions.value = groups;
    } finally {
        addressLoading.value = false;
    }
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
</script>

<template>
    <n-flex class="address-row" align="center" justify="center" :wrap="true">
        <n-select v-model:value="addressValue" :options="addressOptions" :size="size" filterable
            :loading="addressLoading" :placeholder="t('address')" @update:value="onAddressChange"
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
