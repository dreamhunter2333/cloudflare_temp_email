import { h, onBeforeUnmount, onMounted, ref } from 'vue';
import { NTag } from 'naive-ui';
import { isAddressExpiredAt, utcToLocalDate } from './index';

/**
 * Provides a lifecycle-managed reactive timestamp (in ms) so mailbox expiry
 * status indicators update automatically if a deadline passes while open.
 */
export const useNowMs = (intervalMs: number = 10_000) => {
    const nowMs = ref(Date.now());
    let timer: ReturnType<typeof setInterval> | null = null;

    onMounted(() => {
        timer = setInterval(() => {
            nowMs.value = Date.now();
        }, intervalMs);
    });

    onBeforeUnmount(() => {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    });

    return nowMs;
};

/**
 * Renders the `expires_at` cell for mailbox tables, highlighting expired
 * mailboxes that are disabled and awaiting scheduled or manual cleanup.
 */
export const renderAddressExpiryCell = (
    expiresAt: string | null | undefined,
    useUTCDate: boolean,
    t: (key: string) => string,
    nowMs: number = Date.now(),
) => {
    if (!expiresAt) {
        return t('neverExpires');
    }
    const formatted = utcToLocalDate(expiresAt, useUTCDate);
    if (!isAddressExpiredAt(expiresAt, nowMs)) {
        return formatted;
    }
    return h(
        'div',
        {
            style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
            },
        },
        [
            h(
                NTag,
                { type: 'error', size: 'small', bordered: false },
                { default: () => t('expiredPendingDeletion') },
            ),
            h('span', formatted),
        ],
    );
};
