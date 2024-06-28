import { ref } from "vue";
import { createGlobalState, useStorage, useDark, useToggle } from '@vueuse/core'

export const useGlobalState = createGlobalState(
    () => {
        const isDark = useDark()
        const toggleDark = useToggle(isDark)
        const loading = ref(false);
        const openSettings = ref({
            title: '',
            prefix: '',
            needAuth: false,
            adminContact: '',
            enableUserCreateEmail: false,
            enableUserDeleteEmail: false,
            enableAutoReply: false,
            enableIndexAbout: false,
            /** @type {Array<{label: string, value: string}>} */
            domains: [],
            copyright: 'Dream Hunter',
            cfTurnstileSiteKey: '',
            enableWebhook: false,
            isS3Enabled: false,
        })
        const settings = ref({
            fetched: false,
            send_balance: 0,
            address: '',
            auto_reply: {
                subject: '',
                message: '',
                enabled: false,
                source_prefix: '',
                name: '',
            }
        });
        const sendMailModel = useStorage('sendMailModel', {
            fromName: "",
            toName: "",
            toMail: "",
            subject: "",
            contentType: 'text',
            content: "",
        });
        const showAuth = ref(false);
        const showAddressCredential = ref(false);
        const showAdminAuth = ref(false);
        const auth = useStorage('auth', '');
        const adminAuth = useStorage('adminAuth', '');
        const jwt = useStorage('jwt', '');
        const adminTab = ref("account");
        const adminMailTabAddress = ref("");
        const adminSendBoxTabAddress = ref("");
        const mailboxSplitSize = useStorage('mailboxSplitSize', 0.25);
        const useIframeShowMail = useStorage('useIframeShowMail', false);
        const preferShowTextMail = useStorage('preferShowTextMail', false);
        const userJwt = useStorage('userJwt', '');
        const userTab = useStorage('userTab', 'user_settings');
        const indexTab = useStorage('indexTab', 'mailbox');
        const globalTabplacement = useStorage('globalTabplacement', 'top');
        const useSideMargin = useStorage('useSideMargin', true);
        const userOpenSettings = ref({
            enable: false,
            enableMailVerify: false,
        });
        const userSettings = ref({
            /** @type {boolean} */
            fetched: false,
            /** @type {string} */
            user_email: '',
            /** @type {number} */
            user_id: 0,
        });
        const telegramApp = ref(window.Telegram?.WebApp || {});
        const isTelegram = ref(!!window.Telegram?.WebApp?.initData);
        return {
            isDark,
            toggleDark,
            loading,
            settings,
            sendMailModel,
            openSettings,
            showAuth,
            showAddressCredential,
            auth,
            jwt,
            adminAuth,
            showAdminAuth,
            adminTab,
            adminMailTabAddress,
            adminSendBoxTabAddress,
            mailboxSplitSize,
            useIframeShowMail,
            preferShowTextMail,
            userJwt,
            userTab,
            indexTab,
            userOpenSettings,
            userSettings,
            globalTabplacement,
            useSideMargin,
            telegramApp,
            isTelegram,
        }
    },
)
