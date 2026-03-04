/**
 * Build the send-mail model for replying to an email.
 * @param {Object} mail - The mail object (curMail)
 * @param {string} replyLabel - Translated "Reply" label
 * @returns {Object} Fields to assign onto sendMailModel
 */
export function buildReplyModel(mail, replyLabel) {
  const emailRegex = /(.+?) <(.+?)>/;
  let toMail = mail.originalSource;
  let toName = "";
  const match = emailRegex.exec(mail.source);
  if (match) {
    toName = match[1];
    toMail = match[2];
  }
  const bodyContent = mail.message || mail.text;
  return {
    toName,
    toMail,
    subject: `${replyLabel}: ${mail.subject}`,
    contentType: 'rich',
    content: bodyContent
      ? `<p><br></p><blockquote>${bodyContent}</blockquote><p><br></p>`
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
    content: mail.message || mail.text,
  };
}
