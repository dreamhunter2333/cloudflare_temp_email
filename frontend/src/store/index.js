import { ref } from "vue";
import { createGlobalState, useStorage } from '@vueuse/core'
import { useDark, useToggle } from '@vueuse/core'

export const useGlobalState = createGlobalState(
    () => {
        const isDark = useDark()
        const toggleDark = useToggle(isDark)
        const loading = ref(false);
        const openSettings = ref({
            prefix: '',
            needAuth: false,
            adminContact: '',
            enableUserCreateEmail: false,
            enableUserDeleteEmail: false,
            enableAutoReply: false,
            domains: [],
            copyright: 'Dream Hunter',
        })
        const settings = ref({
            fetched: false,
            has_v1_mails: false,
            send_balance: 0,
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
        const localeCache = useStorage('locale', 'zh');
        const themeSwitch = useStorage('themeSwitch', false);
        const adminTab = ref("account");
        const adminMailTabAddress = ref("");
        const adminSendBoxTabAddress = ref("");
        return {
            isDark,
            toggleDark,
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
            adminTab,
            adminMailTabAddress,
            adminSendBoxTabAddress,
        }
    },
)
