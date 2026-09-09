<script setup lang="ts">
import { ref, h, computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useScopedI18n } from '@/i18n/app'
import { NPopconfirm, NButton } from 'naive-ui'
import { getCachedAddresses } from '../../utils/local-address-cache'
import type { CachedAddress } from '../../utils/local-address-cache'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import Login from '../common/Login.vue';

const { jwt, openSettings } = useGlobalState()
// @ts-ignore
const message = useMessage()

const { t } = useScopedI18n('views.index.LocalAddress')
const { t: loginT } = useScopedI18n('views.common.Login')

const tabValue = ref('address')
const localAddressCache = useLocalStorage<(string | CachedAddress)[]>("LocalAddressCache", []);
const data = computed(() => {
    return getCachedAddresses(localAddressCache.value).map(({ token, address, type }, index) => {
        const isPasswordLogin = type === 'address_password_login';
        if (address && openSettings.value.addressPasswordLoginOnly && !isPasswordLogin) return null;
        return {
            address: address
                ? `${address} (${loginT(isPasswordLogin ? 'passwordLogin' : 'credentialLogin')})`
                : t('savedMailbox', { index: index + 1 }),
            jwt: token
        }
    }).filter(Boolean)
})

const bindAddress = () => {
    tabValue.value = 'address'
    message.success(t('bindAddressSuccess'));
}

const columns = [
    {
        title: t('address'),
        key: "address"
    },
    {
        title: t('actions'),
        key: 'actions',
        render(row: any) {
            return h('div', [
                h(NPopconfirm,
                    {
                        onPositiveClick: () => {
                            jwt.value = row.jwt
                            location.reload()
                        }
                    },
                    {
                        trigger: () => h(NButton,
                            {
                                tertiary: true,
                                type: "primary",
                            },
                            { default: () => t('changeMailAddress') }
                        ),
                        default: () => `${t('changeMailAddress')}?`
                    }
                ),
                h(NPopconfirm,
                    {
                        onPositiveClick: () => {
                            if (jwt.value === row.jwt) {
                                return;
                            }
                            localAddressCache.value = getCachedAddresses(localAddressCache.value).filter(
                                entry => entry.token !== row.jwt
                            );
                        }
                    },
                    {
                        trigger: () => h(NButton,
                            {
                                tertiary: true,
                                disabled: jwt.value === row.jwt,
                                type: "warning",
                            },
                            { default: () => t('unbindMailAddress') }
                        ),
                        default: () => `${t('unbindMailAddress')}?`
                    }
                )
            ])
        }
    }
]
</script>

<template>
    <div>
        <n-alert type="warning" :show-icon="false" :bordered="false">
            <span>{{ t('tip') }}</span>
        </n-alert>
        <n-tabs type="segment" v-model:value="tabValue">
            <n-tab-pane name="address" :tab="t('address')">
                <div class="address-table-scroll">
                    <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
                </div>
            </n-tab-pane>
            <n-tab-pane name="create_or_bind" :tab="t('create_or_bind')">
                <Login :bindUserAddress="bindAddress" />
            </n-tab-pane>
        </n-tabs>
    </div>
</template>

<style scoped>
.n-data-table {
    min-width: 640px;
}

.address-table-scroll {
    max-width: 100%;
    overflow-x: auto;
}
</style>
