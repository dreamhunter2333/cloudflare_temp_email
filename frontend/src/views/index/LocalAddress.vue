<script setup lang="ts">
import { ref, h, computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { useI18n } from 'vue-i18n'
import { NPopconfirm, NButton } from 'naive-ui'

// @ts-ignore
import { useGlobalState } from '../../store'
// @ts-ignore
import Login from '../common/Login.vue';

const { jwt } = useGlobalState()
// @ts-ignore
const message = useMessage()

const { t } = useI18n({
    messages: {
        en: {
            tip: 'These addresses are stored in your browser, maybe loss if you clear the browser cache.',
            success: 'success',
            address: 'Address',
            actions: 'Actions',
            changeMailAddress: 'Change Mail Address',
            unbindMailAddress: 'Unbind Mail Address credential',
            create_or_bind: 'Create or Bind',
            bindAddressSuccess: 'Bind Address Success',
        },
        zh: {
            tip: '这些地址存储在您的浏览器中，如果您清除浏览器缓存，可能会丢失。',
            success: '成功',
            address: '地址',
            actions: '操作',
            changeMailAddress: '切换邮箱地址',
            unbindMailAddress: '解绑邮箱地址',
            create_or_bind: '创建或绑定',
            bindAddressSuccess: '绑定地址成功',
        }
    }
});

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
            var payload = JSON.parse(
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
                <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
            </n-tab-pane>
            <n-tab-pane name="create_or_bind" :tab="t('create_or_bind')">
                <Login :bindUserAddress="bindAddress" />
            </n-tab-pane>
        </n-tabs>
    </div>
</template>
