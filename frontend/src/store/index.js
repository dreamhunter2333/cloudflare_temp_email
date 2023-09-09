import { ref } from "vue";
import { createGlobalState, useStorage } from '@vueuse/core'

export const useGlobalState = createGlobalState(
    () => {
        const loading = ref(false);
        const openSettings = ref({
            prefix: '',
            auth: false,
            domains: [{
                label: 'test.com',
                value: 'test.com'
            }]
        })
        const showAuth = ref(false);
        const auth = useStorage('auth', '');
        const jwt = useStorage('jwt', '');
        const localeCache = useStorage('locale', 'zhCN');
        const themeSwitch = useStorage('themeSwitch', false);
        return {
            loading,
            openSettings,
            showAuth,
            auth,
            jwt,
            localeCache,
            themeSwitch
        }
    },
)
