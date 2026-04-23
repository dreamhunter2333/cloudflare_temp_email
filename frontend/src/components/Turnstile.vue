<script setup>
import { ref, watch } from "vue";
import { useAppI18n as useI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import { getTurnstileLocale } from '../i18n/locale-registry'
import { isSupportedLocale } from '../i18n/utils'
const { openSettings, isDark } = useGlobalState()

const cfToken = defineModel('value')

const { locale, t } = useI18n({
    messages: {
        en: {
            refresh: 'Refresh'
        },
        zh: {
            refresh: '刷新'
        }
    }
});

const containerId = `cf-turnstile-${Math.random().toString(36).slice(2, 9)}`
const cfTurnstileId = ref("")
const turnstileLoading = ref(false)
let turnstileRenderQueue = Promise.resolve()

const refresh = () => rerenderTurnstile()
defineExpose({ refresh })

const rerenderTurnstile = () => {
    cfToken.value = "";
    turnstileRenderQueue = turnstileRenderQueue
        .catch(() => { })
        .then(() => checkCfTurnstile(true))
    turnstileRenderQueue.catch(() => { })
    return turnstileRenderQueue
}

const checkCfTurnstile = async (remove) => {
    if (!openSettings.value.cfTurnstileSiteKey) return;
    turnstileLoading.value = true;
    try {
        let container = document.getElementById(containerId);
        let count = 100;
        while (!container && count-- > 0) {
            container = document.getElementById(containerId);
            await new Promise(r => setTimeout(r, 10));
        }
        count = 100;
        while (!window.turnstile && count-- > 0) {
            await new Promise(r => setTimeout(r, 10));
        }
        if (remove && cfTurnstileId.value) {
            window.turnstile.remove(cfTurnstileId.value);
        }
        // Cloudflare documents sitekey/theme/language as render-time options and
        // exposes remove()/render() for widget lifecycle updates, so recreate the
        // widget when any of those inputs change:
        // https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
        cfTurnstileId.value = window.turnstile.render(
            `#${containerId}`,
            {
                sitekey: openSettings.value.cfTurnstileSiteKey,
                language: getTurnstileLocale(isSupportedLocale(locale.value) ? locale.value : 'en'),
                theme: isDark.value ? 'dark' : 'light',
                callback: function (token) {
                    cfToken.value = token;
                },
            }
        );
    } finally {
        turnstileLoading.value = false;
    }
}

watch([isDark, locale, () => openSettings.value.cfTurnstileSiteKey], rerenderTurnstile, { immediate: true })
</script>

<template>
    <div v-if="openSettings.cfTurnstileSiteKey" class="center">
        <n-spin description="loading..." :show="turnstileLoading">
            <n-form-item-row>
                <n-flex vertical>
                    <div :id="containerId"></div>
                    <n-button text @click="rerenderTurnstile">
                        {{ t('refresh') }}
                    </n-button>
                </n-flex>
            </n-form-item-row>
        </n-spin>

    </div>
</template>

<style scoped>
.center {
    display: flex;
}

.n-button {
    margin-left: 10px;
}
</style>
