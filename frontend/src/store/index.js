import { computed, ref } from "vue";
import {
    createGlobalState, useStorage, useDark, useToggle,
    useLocalStorage, useSessionStorage
} from '@vueuse/core'

export const useGlobalState = createGlobalState(
    () => {
        const isDark = useDark()
        const toggleDark = useToggle(isDark)
        const loading = ref(false);
        const announcement = useLocalStorage('announcement', '');
        const useSimpleIndex = useLocalStorage('useSimpleIndex', false);
        const openSettings = ref({
            fetched: false,
            title: '',
            announcement: '',
            alwaysShowAnnouncement: false,
            prefix: '',
            addressRegex: '',
            needAuth: false,
            adminContact: '',
            enableUserCreateEmail: false,
            disableAnonymousUserCreateEmail: false,
            disableCustomAddressName: false,
            enableUserDeleteEmail: false,
            enableAutoReply: false,
            enableIndexAbout: false,
            /** @type {string[]} */
            defaultDomains: [],
            /** @type {Array<{label: string, value: string}>} */
            domains: [],
            copyright: 'Dream Hunter',
            cfTurnstileSiteKey: '',
            enableWebhook: false,
            isS3Enabled: false,
            showGithub: true,
            disableAdminPasswordCheck: false,
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
        const sendMailModel = useSessionStorage('sendMailModel', {
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
        const adminTab = useSessionStorage('adminTab', "account");
        const adminMailTabAddress = ref("");
        const adminSendBoxTabAddress = ref("");
        const mailboxSplitSize = useStorage('mailboxSplitSize', 0.25);
        const useIframeShowMail = useStorage('useIframeShowMail', false);
        const preferShowTextMail = useStorage('preferShowTextMail', false);
        const userJwt = useStorage('userJwt', '');
        const userTab = useSessionStorage('userTab', 'address_management');
        const indexTab = useSessionStorage('indexTab', 'mailbox');
        const globalTabplacement = useStorage('globalTabplacement', 'top');
        const useSideMargin = useStorage('useSideMargin', true);
        const useUTCDate = useStorage('useUTCDate', false);
        const autoRefresh = useStorage('autoRefresh', false);
        const configAutoRefreshInterval = useStorage("configAutoRefreshInterval", 60);
        const userOpenSettings = ref({
            fetched: false,
            enable: false,
            enableMailVerify: false,
            /** @type {{ clientID: string, name: string }[]} */
            oauth2ClientIDs: [],
        });
        const userSettings = ref({
            /** @type {boolean} */
            fetched: false,
            /** @type {string} */
            user_email: '',
            /** @type {number} */
            user_id: 0,
            /** @type {boolean} */
            is_admin: false,
            /** @type {string | null} */
            access_token: null,
            /** @type {string | null} */
            new_user_token: null,
            /** @type {null | {domains: string[] | undefined | null, role: string, prefix: string | undefined | null}} */
            user_role: null,
        });
        const showAdminPage = computed(() =>
            !!adminAuth.value
            || userSettings.value.is_admin
            || openSettings.value.disableAdminPasswordCheck
        );
        const telegramApp = ref(window.Telegram?.WebApp || {});
        const isTelegram = ref(!!window.Telegram?.WebApp?.initData);
        const userOauth2SessionState = useSessionStorage('userOauth2SessionState', '');
        const userOauth2SessionClientID = useSessionStorage('userOauth2SessionClientID', '');
        return {
            isDark,
            toggleDark,
            loading,
            settings,
            sendMailModel,
            announcement,
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
            useUTCDate,
            autoRefresh,
            configAutoRefreshInterval,
            telegramApp,
            isTelegram,
            showAdminPage,
            userOauth2SessionState,
            userOauth2SessionClientID,
            useSimpleIndex,
        }
    },
)
