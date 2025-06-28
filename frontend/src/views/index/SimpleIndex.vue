<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import {
    ExitToAppFilled,
    ContentCopyFilled,
    RefreshFilled,
    ArrowBackIosNewFilled,
    ArrowForwardIosFilled,
    SettingsFilled
} from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import Login from '../common/Login.vue'
import AccountSettings from './AccountSettings.vue'
import { processItem } from '../../utils/email-parser'
import { utcToLocalDate } from '../../utils'
import ShadowHtmlComponent from '../../components/ShadowHtmlComponent.vue'

const { jwt, settings, useSimpleIndex, useUTCDate, showAddressCredential } = useGlobalState()
const message = useMessage()

// 邮件数据
const currentPage = ref(1)
const totalCount = ref(0)
const loading = ref(false)
const currentMail = ref(null)
const showAccountSettingsCard = ref(false)

const { t } = useI18n({
    messages: {
        en: {
            exitSimpleIndex: 'Exit Simple',
            copyAddress: 'Copy',
            addressCopied: 'Address copied successfully',
            refreshMails: 'Refresh',
            noMails: 'No mails found',
            prevPage: 'Previous',
            nextPage: 'Next',
            refreshSuccess: 'Mails refreshed successfully',
            mailCount: '{current} / {total} emails',
            accountSettings: "Account Settings",
            addressCredential: 'Mail Address Credential',
            addressCredentialTip: 'Please copy the Mail Address Credential and you can use it to login',
        },
        zh: {
            exitSimpleIndex: '退出极简',
            copyAddress: '复制',
            addressCopied: '地址复制成功',
            refreshMails: '刷新',
            noMails: '暂无邮件',
            prevPage: '上一页',
            nextPage: '下一页',
            refreshSuccess: '邮件刷新成功',
            mailCount: '{current} / {total} 封邮件',
            accountSettings: "账户设置",
            addressCredential: '邮箱地址凭证',
            addressCredentialTip: '请复制邮箱地址凭证，你可以使用它登录你的邮箱。'
        }
    }
})

// 复制地址
const copyAddress = async () => {
    try {
        await navigator.clipboard.writeText(settings.value.address)
        message.success(t('addressCopied'))
    } catch (error) {
        message.error('复制失败')
    }
}

// 获取邮件数据
const fetchMails = async () => {
    if (!settings.value.address) return
    try {
        const { results, count } = await api.fetch(`/api/mails?limit=1&offset=${currentPage.value - 1}`)
        totalCount.value = count > 0 ? count : totalCount.value;
        const rawMail = results && results.length > 0 ? results[0] : null
        currentMail.value = rawMail ? await processItem(rawMail) : null
    } catch (error) {
        console.error('Failed to fetch mails:', error)
        message.error('获取邮件失败')
    }
}

// 刷新邮件
const refreshMails = async () => {
    currentPage.value = 1
    await fetchMails()
    message.success(t('refreshSuccess'))
}

// 分页控制
const currentPageDisplay = computed(() => currentPage.value)
const totalPages = computed(() => Math.max(1, totalCount.value))
const canGoPrev = computed(() => currentPage.value > 1)
const canGoNext = computed(() => currentPage.value < totalPages.value)

const prevPage = async () => {
    if (canGoPrev.value) {
        currentPage.value--
    }
}

const nextPage = async () => {
    if (canGoNext.value) {
        currentPage.value++
    }
}

// 监听页面变化
watch(currentPage, () => {
    fetchMails()
})

onMounted(async () => {
    await api.getSettings()
    await fetchMails()
})
</script>

<template>
    <div class="center">
        <div v-if="!settings.address">
            <n-card :bordered="false" embedded>
                <Login />
            </n-card>
        </div>

        <div v-else>
            <n-card :bordered="false" embedded>
                <div style="text-align: center; margin-bottom: 16px; font-size: 18px;">
                    <n-text strong size="large">{{ settings.address }}</n-text>
                </div>
                <n-flex justify="center">
                    <n-button @click="refreshMails" :loading="loading" type="primary" tertiary size="small">
                        <template #icon>
                            <n-icon>
                                <RefreshFilled />
                            </n-icon>
                        </template>
                        {{ t('refreshMails') }}
                    </n-button>
                    <n-button @click="copyAddress" tertiary size="small">
                        <template #icon>
                            <n-icon>
                                <ContentCopyFilled />
                            </n-icon>
                        </template>
                        {{ t('copyAddress') }}
                    </n-button>
                    <n-button @click="useSimpleIndex = false" tertiary size="small">
                        <template #icon>
                            <n-icon>
                                <ExitToAppFilled />
                            </n-icon>
                        </template>
                        {{ t('exitSimpleIndex') }}
                    </n-button>
                    <n-button @click="showAccountSettingsCard = true" tertiary size="small">
                        <template #icon>
                            <n-icon>
                                <SettingsFilled />
                            </n-icon>
                        </template>
                        {{ t('accountSettings') }}
                    </n-button>
                </n-flex>
            </n-card>

            <!-- 账户设置卡片 -->
            <n-card v-if="showAccountSettingsCard" :bordered="false" embedded closable
                @close="showAccountSettingsCard = false" :title="t('accountSettings')">
                <AccountSettings />
            </n-card>

            <n-card :bordered="false" embedded style="text-align: left;">

                <div v-if="totalCount > 1">
                    <n-flex justify="space-between">
                        <n-button @click="prevPage" :disabled="!canGoPrev" text size="small">
                            <template #icon>
                                <n-icon>
                                    <ArrowBackIosNewFilled />
                                </n-icon>
                            </template>
                            {{ t('prevPage') }}
                        </n-button>
                        <n-text size="small">
                            {{ t('mailCount', { current: currentPageDisplay, total: totalCount }) }}
                        </n-text>
                        <n-button @click="nextPage" :disabled="!canGoNext" text size="small" icon-placement="right">
                            <template #icon>
                                <n-icon>
                                    <ArrowForwardIosFilled />
                                </n-icon>
                            </template>
                            {{ t('nextPage') }}
                        </n-button>
                    </n-flex>
                </div>

                <div v-if="!currentMail" class="no-mail">
                    <n-empty :description="t('noMails')" />
                </div>
                <div v-else>
                    <h3 v-if="currentMail.subject">{{ currentMail.subject }}</h3>

                    <n-space>
                        <n-tag type="info">
                            ID: {{ currentMail.id }}
                        </n-tag>
                        <n-tag type="info">
                            {{ utcToLocalDate(currentMail.created_at, useUTCDate.value) }}
                        </n-tag>
                        <n-tag type="info">
                            FROM: {{ currentMail.source }}
                        </n-tag>
                    </n-space>

                    <div style="margin-top: 16px;">
                        <ShadowHtmlComponent v-if="currentMail.message" :htmlContent="currentMail.message" />
                        <pre v-else>{{ currentMail.text }}</pre>
                    </div>
                </div>
            </n-card>
        </div>
        <n-modal v-model:show="showAddressCredential" preset="dialog" :title="t('addressCredential')">
            <span>
                <p>{{ t("addressCredentialTip") }}</p>
            </span>
            <n-card embedded>
                <b>{{ jwt }}</b>
            </n-card>
        </n-modal>
    </div>
</template>

<style scoped>
.center {
    max-width: 800px;
    margin: 0 auto;
}

.n-card {
    margin-top: 20px;
    width: 100%;
}
</style>
