<script setup>
import { ref, h, onMounted, watch } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router';
import { NBadge, NPopconfirm, NButton } from 'naive-ui'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { getRouterPathWithLang, hashPassword } from '../../utils'
import AddressCredentialModal from '../../components/AddressCredentialModal.vue'

import Login from '../common/Login.vue';

const { jwt, openSettings, loading } = useGlobalState()
const message = useMessage()
const router = useRouter()

const { locale, t } = useScopedI18n('views.user.AddressManagement')
const { t: credentialT } = useScopedI18n('components.AddressCredentialModal')

const data = ref([])
const count = ref(0)
const page = ref(1)
const pageSize = ref(20)
const showTranferAddress = ref(false)
const currentAddress = ref("")
const currentAddressId = ref(0)
const targetUserEmail = ref('')
const showAddressCredential = ref(false)
const currentAddressCredential = ref('')
const credentialAddress = ref('')
const passwordResetAddress = ref(null)
const newPassword = ref('')
const confirmPassword = ref('')
const isResettingPassword = ref(false)
const { t: accountSettingsT } = useScopedI18n('views.index.AccountSettings')

const clearPasswordResetForm = () => {
    passwordResetAddress.value = null;
    newPassword.value = '';
    confirmPassword.value = '';
}

const resetBoundAddressPassword = async () => {
    if (!passwordResetAddress.value || isResettingPassword.value) return;
    if (!newPassword.value) {
        message.error(t('newPasswordRequired'));
        return;
    }
    if (newPassword.value !== confirmPassword.value) {
        message.error(accountSettingsT('passwordMismatch'));
        return;
    }
    isResettingPassword.value = true;
    try {
        await api.fetch(`/user_api/address/${passwordResetAddress.value.id}/reset_password`, {
            method: 'POST',
            body: JSON.stringify({ new_password: await hashPassword(newPassword.value) }),
        });
        message.success(accountSettingsT('passwordChanged'));
        clearPasswordResetForm();
    } catch (error) {
        message.error(error.message || 'error');
    } finally {
        isResettingPassword.value = false;
    }
}


const showCredential = async (row) => {
    try {
        const { jwt: addressCredential } = await api.fetch(`/user_api/bind_address_jwt/${row.id}`)
        currentAddressCredential.value = addressCredential
        credentialAddress.value = row.name
        showAddressCredential.value = true
    } catch (error) {
        message.error(error.message || "error")
    }
}

const changeMailAddress = async (address_id) => {
    try {
        const res = await api.fetch(`/user_api/bind_address_jwt/${address_id}`);
        if (!res.jwt) {
            message.error("jwt not found");
            return;
        }
        jwt.value = res.jwt;
        await router.push(getRouterPathWithLang("/", locale.value))
        location.reload();
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const unbindAddress = async (address_id) => {
    try {
        const res = await api.fetch(`/user_api/unbind_address`, {
            method: 'POST',
            body: JSON.stringify({ address_id })
        });
        message.success(t('unbindAddress') + " " + t('success'));
        if (page.value === 1) {
            await fetchData();
        } else {
            page.value = 1;
        }
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const transferAddress = async () => {
    if (!targetUserEmail.value) {
        message.error("targetUserEmail is required");
        return;
    }
    if (!currentAddressId.value) {
        message.error("currentAddressId is required");
        return;
    }
    try {
        const res = await api.fetch(`/user_api/transfer_address`, {
            method: 'POST',
            body: JSON.stringify({
                address_id: currentAddressId.value,
                target_user_email: targetUserEmail.value
            })
        });
        message.success(t('transferAddress') + " " + t('success'));
        if (page.value === 1) {
            await fetchData();
        } else {
            page.value = 1;
        }
        showTranferAddress.value = false;
        currentAddressId.value = 0;
        currentAddress.value = "";
        targetUserEmail.value = "";
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const fetchData = async () => {
    try {
        const params = new URLSearchParams({
            limit: String(pageSize.value),
            offset: String((page.value - 1) * pageSize.value),
        });
        const { results, count: addressCount } = await api.fetch(
            `/user_api/bind_address?${params.toString()}`
        );
        data.value = results;
        if (page.value === 1) {
            count.value = addressCount;
        }
    } catch (error) {
        console.log(error)
        message.error(error.message || "error");
    }
}

const columns = [
    {
        title: t('emailAddress'),
        key: "name"
    },
    {
        title: t('mail_count'),
        key: "mail_count",
        render(row) {
            return h(NBadge, {
                value: row.mail_count,
                'show-zero': true,
                max: 99,
                type: "success"
            })
        }
    },
    {
        title: t('send_count'),
        key: "send_count",
        render(row) {
            return h(NBadge, {
                value: row.send_count,
                'show-zero': true,
                max: 99,
                type: "success"
            })
        }
    },
    {
        title: t('actions'),
        key: 'actions',
        render(row) {
            return h('div', [
                !openSettings.value.addressPasswordLoginOnly ? h(NButton,
                    {
                        tertiary: true,
                        type: "primary",
                        onClick: () => showCredential(row)
                    },
                    { default: () => credentialT('addressCredential') }
                ) : null,
                openSettings.value.enableAddressPassword ? h(NButton,
                    {
                        tertiary: true,
                        type: 'warning',
                        onClick: () => {
                            newPassword.value = '';
                            confirmPassword.value = '';
                            passwordResetAddress.value = row;
                        },
                    },
                    { default: () => t('resetPassword') }
                ) : null,
                h(NPopconfirm,
                    {
                        onPositiveClick: () => changeMailAddress(row.id)
                    },
                    {
                        trigger: () => h(NButton,
                            {
                                tertiary: true,
                                type: "primary",
                            },
                            { default: () => t('openMailbox') }
                        ),
                        default: () => `${t('openMailbox')}?`
                    }
                ),
                h(NButton,
                    {
                        tertiary: true,
                        type: "primary",
                        onClick: () => {
                            currentAddressId.value = row.id;
                            currentAddress.value = row.name;
                            showTranferAddress.value = true;
                        }
                    },
                    { default: () => t('transferAddress') }
                ),
                h(NPopconfirm,
                    {
                        onPositiveClick: () => unbindAddress(row.id)
                    },
                    {
                        trigger: () => h(NButton,
                            {
                                tertiary: true,
                                type: "error",
                            },
                            { default: () => t('unbindAddress') }
                        ),
                        default: () => t(openSettings.value.addressPasswordLoginOnly ? 'unbindPasswordTip' : 'unbindAddressTip')
                    }
                ),
            ])
        }
    }
]

onMounted(async () => {
    await fetchData()
})

watch([page, pageSize], async () => {
    await fetchData();
})
</script>

<template>
    <div>
        <n-modal :show="!!passwordResetAddress" @update:show="show => { if (!show && !isResettingPassword) clearPasswordResetForm() }"
            preset="dialog" :title="t('resetPassword')" :mask-closable="!isResettingPassword" :closable="!isResettingPassword">
            <p>{{ passwordResetAddress?.name }}</p>
            <p>{{ t('resetPasswordTip') }}</p>
            <n-form @submit.prevent="resetBoundAddressPassword">
                <n-form-item :label="accountSettingsT('newPassword')">
                    <n-input v-model:value="newPassword" type="password" show-password-on="click" :disabled="isResettingPassword" />
                </n-form-item>
                <n-form-item :label="accountSettingsT('confirmPassword')">
                    <n-input v-model:value="confirmPassword" type="password" show-password-on="click"
                        :disabled="isResettingPassword" @keyup.enter="resetBoundAddressPassword" />
                </n-form-item>
            </n-form>
            <template #action>
                <n-button type="warning" :loading="isResettingPassword" @click="resetBoundAddressPassword">{{ t('resetPassword') }}</n-button>
            </template>
        </n-modal>
        <AddressCredentialModal v-model:show="showAddressCredential" :address="credentialAddress"
            :jwt="currentAddressCredential" />
        <n-modal v-model:show="showTranferAddress" preset="dialog" :title="t('transferAddress')">
            <span>
                <p>{{ t("transferAddressTip") }}</p>
                <p>{{ t('transferAddress') + ": " + currentAddress }}</p>
                <n-input v-model:value="targetUserEmail" :placeholder="t('targetUserEmail')" />
            </span>
            <template #action>
                <n-button :loading="loading" @click="transferAddress" size="small" tertiary type="error">
                    {{ t('transferAddress') }}
                </n-button>
            </template>
        </n-modal>
        <n-tabs type="segment">
            <n-tab-pane name="address" :tab="t('address')">
                <div class="address-table-scroll">
                    <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count"
                        :page-sizes="[20, 50, 100]" show-size-picker>
                        <template #prefix="{ itemCount }">
                            {{ t('itemCount') }}: {{ itemCount }}
                        </template>
                    </n-pagination>
                    <n-data-table :columns="columns" :data="data" :bordered="false" embedded />
                </div>
            </n-tab-pane>
            <n-tab-pane name="create_or_bind" :tab="t('create_or_bind')">
                <Login />
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

.n-pagination {
    margin-top: 10px;
    margin-bottom: 10px;
}
</style>
