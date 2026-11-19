import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import DOMPurify from 'dompurify';
import { useScopedI18n } from '@/i18n/app';
import { api } from '../../api';
import { useGlobalState } from '../../store';
import { blockRemoteContent } from '../../utils/remote-content-policy';

const BLOCK_TAGS = ['p', 'div', 'br', 'li', 'tr', 'td', 'th', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

function getMailText(mail, translate) {
  const text = mail.text?.trim() || '';
  if ((!translate && text) || !mail.message || mail.message === mail.raw || mail.message === mail.text) return text;

  const content = DOMPurify.sanitize(mail.message, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ['a', 'table', 'thead', 'tbody', 'tfoot', 'ul', 'ol', ...BLOCK_TAGS],
    ALLOWED_ATTR: ['href'],
  });
  if (translate) {
    for (const link of content.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href').trim();
      if (/^https?:\/\//i.test(href) && !link.textContent.includes(href)) link.after(` (${href})`);
    }
  }
  for (const block of content.querySelectorAll(BLOCK_TAGS.join(','))) {
    block.after('\n');
  }
  return content.textContent.trim() || text;
}

function getTranslationHtml(mail) {
  if (!mail.message || mail.message === mail.raw || mail.message === mail.text) return '';
  const template = document.createElement('template');
  template.innerHTML = blockRemoteContent(mail.message, { allowRemoteImages: true }).html;
  // The mail parser can synthesize HTML with only line breaks for plain-text mail.
  return template.content.querySelector('*:not(br)') ? template.innerHTML : '';
}

export function useMailProcessing(currentMail, translation, showTextMail) {
  const { t, locale } = useScopedI18n('components.MailProcessing');
  const { mailTranslationLanguage } = useGlobalState();
  const request = shallowRef(null);
  const pending = computed(() => request.value?.action);
  const summary = ref(null);
  const error = ref('');

  onBeforeUnmount(() => {
    request.value = null;
  });

  watch(() => currentMail()?.id, () => {
    request.value = null;
    translation.value = null;
    summary.value = null;
    error.value = '';
  }, { flush: 'sync' });

  watch(showTextMail, () => {
    translation.value = null;
    if (request.value?.action === 'translate') request.value = null;
  }, { flush: 'sync' });

  const processMail = async (action) => {
    const mail = currentMail();
    const showOriginal = action === 'translate' && translation.value;
    if (!mail?.id || (request.value && !showOriginal)) return;
    error.value = '';
    if (showOriginal) {
      translation.value = null;
      return;
    }
    if (action === 'summarize') summary.value = null;
    const targetLanguage = action === 'translate' ? mailTranslationLanguage.value || undefined : undefined;
    const language = targetLanguage || locale.value;
    const current = { action };
    request.value = current;
    try {
      const sourceHtml = action === 'translate' && !showTextMail.value ? getTranslationHtml(mail) : '';
      const displayedText = showTextMail.value ? mail.text?.trim() : '';
      const content = sourceHtml ? { html: sourceHtml } : { text: displayedText || getMailText(mail, action === 'translate') };
      const { subject, text, html } = await api.fetch(`/api/mails/${mail.id}/${action}`, {
        method: 'POST', showLoading: false,
        body: { subject: mail.subject || '', ...content, targetLanguage },
      });
      if (request.value !== current) return;
      if (action === 'summarize') {
        summary.value = { text, language };
        return;
      }
      translation.value = { mailId: mail.id, subject, text, html, language };
    } catch (e) {
      if (request.value === current) error.value = e.message || t('failed');
    } finally {
      if (request.value === current) request.value = null;
    }
  };

  return { t, pending, summary, error, processMail };
}
