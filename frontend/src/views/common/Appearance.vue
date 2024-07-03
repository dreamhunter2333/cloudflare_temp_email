<script setup>
import { useI18n } from 'vue-i18n'

import { useIsMobile } from '../../utils/composables'
import { useGlobalState } from '../../store'

const {
    mailboxSplitSize, useIframeShowMail, preferShowTextMail,
    globalTabplacement, useSideMargin
} = useGlobalState()
const isMobile = useIsMobile()

const { t } = useI18n({
    messages: {
        en: {
            mailboxSplitSize: 'Mailbox Split Size',
            useIframeShowMail: 'Use iframe Show HTML Mail',
            preferShowTextMail: 'Display text Mail by default',
            useSideMargin: 'Turn on the side margins on the left and right sides of the page',
            globalTabplacement: 'Global Tab Placement',
            left: 'left',
            top: 'top',
            right: 'right',
            bottom: 'bottom',
        },
        zh: {
            mailboxSplitSize: '邮箱界面分栏大小',
            preferShowTextMail: '默认以文本显示邮件',
            useIframeShowMail: '使用iframe显示HTML邮件',
            globalTabplacement: '全局选项卡位置',
            useSideMargin: '开启页面左右两侧侧边距',
            left: '左侧',
            top: '顶部',
            right: '右侧',
            bottom: '底部',
        }
    }
});
</script>

<template>
    <div class="center">
        <n-card :bordered="false" embedded>
            <n-form-item-row v-if="!isMobile" :label="t('mailboxSplitSize')">
                <n-slider v-model:value="mailboxSplitSize" :min="0.25" :max="0.75" :step="0.01" :marks="{
                    0.25: '0.25',
                    0.5: '0.5',
                    0.75: '0.75'
                }" />
            </n-form-item-row>
            <n-form-item-row :label="t('preferShowTextMail')">
                <n-switch v-model:value="preferShowTextMail" :round="false" />
            </n-form-item-row>
            <n-form-item-row :label="t('useIframeShowMail')">
                <n-switch v-model:value="useIframeShowMail" :round="false" />
            </n-form-item-row>
            <n-form-item-row v-if="!isMobile" :label="t('useSideMargin')">
                <n-switch v-model:value="useSideMargin" :round="false" />
            </n-form-item-row>
            <n-form-item-row :label="t('globalTabplacement')">
                <n-radio-group v-model:value="globalTabplacement">
                    <n-radio-button value="top" :label="t('top')" />
                    <n-radio-button value="left" :label="t('left')" />
                    <n-radio-button value="right" :label="t('right')" />
                    <n-radio-button value="bottom" :label="t('bottom')" />
                </n-radio-group>
            </n-form-item-row>
        </n-card>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    justify-content: center;
}


.n-card {
    max-width: 800px;
    text-align: left;
}
</style>
