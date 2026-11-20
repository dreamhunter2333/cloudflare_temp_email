import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useScopedI18n } from '@/i18n/app';
import { api } from '../../api';
import { useGlobalState } from '../../store';
import { processWithCustomModel } from './customMailModel';
import { useMailboxAiSettings } from './useMailboxAiSettings';

export function useMailProcessing(currentMail, mode, translation) {
  const { t, locale } = useScopedI18n('components.MailProcessing');
  const { mailTranslationLanguage } = useGlobalState();
  const { profile, apiKey } = useMailboxAiSettings();
  const request = shallowRef(null);
  const pending = computed(() => request.value?.action);
  const summary = ref(null);
  const error = ref('');

  onBeforeUnmount(() => {
    request.value?.controller.abort();
    request.value = null;
  });

  watch([() => currentMail()?.id, mode], () => {
    request.value?.controller.abort();
    request.value = null;
    translation.value = null;
    summary.value = null;
    error.value = '';
  }, { flush: 'sync' });

  const processMail = async (action) => {
    const mail = currentMail();
    const access = mode();
    if (!mail?.id || !access || request.value) return;
    error.value = '';
    if (action === 'translate' && translation.value) {
      translation.value = null;
      return;
    }
    if (access === 'custom' && (!profile.value || !apiKey.value)) {
      error.value = t('customSetupRequired');
      return;
    }
    if (action === 'summarize') summary.value = null;
    const targetLanguage = action === 'translate' ? mailTranslationLanguage.value || undefined : undefined;
    const language = targetLanguage || locale.value;
    const current = { action, controller: new AbortController() };
    request.value = current;
    try {
      const { subject, text } = access === 'custom'
        ? await processWithCustomModel({ ...profile.value, apiKey: apiKey.value }, mail, action, language, current.controller.signal, t)
        : await api.fetch('/api/mail_processing', {
          method: 'POST', body: { mailId: mail.id, action, targetLanguage }, showLoading: false,
        });
      if (request.value !== current) return;
      if (action === 'translate') translation.value = { mailId: mail.id, subject, text, language };
      else summary.value = { text, language };
    } catch (e) {
      if (request.value === current) error.value = e.message || t('failed');
    } finally {
      if (request.value === current) request.value = null;
    }
  };

  return { t, pending, summary, error, processMail };
}
