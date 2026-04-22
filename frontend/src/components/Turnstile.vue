<script setup>
import { ref, watch, onMounted } from "vue";
import { useI18n } from 'vue-i18n'
import { useGlobalState } from '../store'
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
// Cloudflare Turnstile supported language codes:
// https://developers.cloudflare.com/turnstile/reference/supported-languages/
const turnstileLanguageMap = {
    zh: 'zh-CN',
    en: 'en',
    es: 'es',
    'pt-BR': 'pt-BR',
    ja: 'ja',
    de: 'de',
}

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
        cfTurnstileId.value = window.turnstile.render(
            `#${containerId}`,
            {
                sitekey: openSettings.value.cfTurnstileSiteKey,
                language: turnstileLanguageMap[locale.value] || 'auto',
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

watch([isDark, locale], rerenderTurnstile)

onMounted(() => {
    rerenderTurnstile();
})
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
