import DOMPurify from 'dompurify';

/**
 * HTML-escape special characters for plain text content.
 */
function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Sanitize mail content: HTML-escape plain text, whitelist-sanitize HTML.
 */
function sanitizeContent(mail) {
  if (mail.message) {
    return DOMPurify.sanitize(mail.message);
  }
  if (mail.text) {
    return escapeHtml(mail.text);
  }
  return '';
}

/**
 * Build the send-mail model for replying to an email.
 * @param {Object} mail - The mail object (curMail)
 * @param {string} replyLabel - Translated "Reply" label
 * @returns {Object} Fields to assign onto sendMailModel
 */
export function buildReplyModel(mail, replyLabel) {
  const emailRegex = /(.+?) <(.+?)>/;
  let toMail = mail.originalSource || '';
  let toName = "";
  const match = emailRegex.exec(mail.source);
  if (match) {
    toName = match[1];
    toMail = match[2];
  }
  const safeContent = sanitizeContent(mail);
  return {
    toName,
    toMail,
    subject: `${replyLabel}: ${mail.subject}`,
    contentType: mail.message ? 'html' : 'rich',
    content: safeContent
      ? `<p><br></p><blockquote>${safeContent}</blockquote><p><br></p>`
      : '',
  };
}

/**
 * Build the send-mail model for forwarding an email.
 * @param {Object} mail - The mail object (curMail)
 * @param {string} forwardLabel - Translated "Forward" label
 * @returns {Object} Fields to assign onto sendMailModel
 */
export function buildForwardModel(mail, forwardLabel) {
  return {
    subject: `${forwardLabel}: ${mail.subject}`,
    contentType: mail.message ? 'html' : 'text',
    content: sanitizeContent(mail),
  };
}
