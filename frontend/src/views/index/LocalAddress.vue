<script setup lang="ts">
import { ref, h, computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useScopedI18n } from '@/i18n/app'
import { NPopconfirm, NButton } from 'naive-ui'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import Login from '../common/Login.vue';

const { jwt } = useGlobalState()
// @ts-ignore
const message = useMessage()

const { t } = useScopedI18n('views.index.LocalAddress')

const tabValue = ref('address')
const localAddressCache = useLocalStorage("LocalAddressCache", []);
const data = computed(() => {
    // @ts-ignore
    if (!localAddressCache.value.includes(jwt.value)) {
        // @ts-ignore
        localAddressCache.value.push(jwt.value)
    }
    return localAddressCache.value.map((curJwt: string) => {
        try {
            const payload = JSON.parse(
                decodeURIComponent(
                    atob(curJwt.split(".")[1]
                        .replace(/-/g, "+").replace(/_/g, "/")
                    )
                )
            );
            return {
                valid: true,
                address: payload.address,
                jwt: curJwt
            }
        } catch (e) {
            return {
                valid: false,
                address: `invalid jwt [${curJwt}]`,
                jwt: curJwt
            }
        }
    })

})

const bindAddress = async () => {
    try {
        // @ts-ignore
        if (!localAddressCache.value.includes(jwt.value)) {
            // @ts-ignore
            localAddressCache.value.push(jwt.value)
        }
        tabValue.value = 'address'
        message.success(t('bindAddressSuccess'));
    } catch (error) {
        message.error((error as Error).message || "error");
    }
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
                            localAddressCache.value = localAddressCache.value.filter(
                                (curJwt: string) => curJwt !== row.jwt
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
.address-table-scroll {
    max-width: 100%;
    overflow-x: auto;
}
</style>
