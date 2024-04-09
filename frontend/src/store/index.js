import { ref } from "vue";
import { createGlobalState, useStorage } from '@vueuse/core'

export const useGlobalState = createGlobalState(
    () => {
        const loading = ref(false);
        const openSettings = ref({
            prefix: '',
            needAuth: false,
            domains: [{
                label: 'test.com',
                value: 'test.com'
            }]
        })
        const settings = ref({
            fetched: false,
            has_v1_mails: false,
            address: '',
            auto_reply: {
                subject: '',
                message: '',
                enabled: false,
                source_prefix: '',
                name: '',
            }
        })
        const showAuth = ref(false);
        const showAdminAuth = ref(false);
        const auth = useStorage('auth', '');
        const adminAuth = useStorage('adminAuth', '');
        const jwt = useStorage('jwt', '');
        const localeCache = useStorage('locale', 'zhCN');
        const themeSwitch = useStorage('themeSwitch', false);
        const showLogin = ref(false);
        return {
            loading,
            settings,
            openSettings,
            showAuth,
            auth,
            jwt,
            localeCache,
            themeSwitch,
            adminAuth,
            showAdminAuth,
            showLogin,
        }
    },
)
