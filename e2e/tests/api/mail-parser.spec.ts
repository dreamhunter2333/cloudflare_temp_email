import { test, expect } from '@playwright/test';
import { commonParseMail } from '../../../worker/src/common';
import { remove_attachment_if_need } from '../../../worker/src/email/check_attachment';

test.describe('Worker PostalMime v4 contract', () => {
  for (const [headers, sender] of [
    ['From: First <first@example.com>\r\nFrom: Last <last@example.com>', 'First <first@example.com>'],
    ['From: invalid\r\nFrom: Last <last@example.com>', 'invalid <>'],
    ['From:\r\nFrom: Last <last@example.com>', ''],
    ['fRoM: "Sender, Display"\r\n <first@example.com>', 'Sender, Display <first@example.com>'],
    ['From: =?UTF-8?B?5Y+R5Lu25Lq6?= <first@example.com>', '发件人 <first@example.com>'],
    ['', ''],
  ]) {
    test(`From: ${JSON.stringify(headers)}`, async () => {
      const context = { rawEmail: [...(headers ? [headers] : []), 'Subject: =?UTF-8?B?5rWL6K+V?=',
        'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '',
        Buffer.from('正文 "quoted" \\path $& ${from}').toString('base64')].join('\r\n') };
      const parsed = await commonParseMail(context);
      expect(parsed?.sender).toBe(sender);
      expect(parsed?.subject).toBe('测试');
      expect(parsed?.text.trim()).toBe('正文 "quoted" \\path $& ${from}');
      expect(parsed?.attachments).toEqual([]);
      expect(await commonParseMail(context)).toBe(parsed);
    });
  }

  test('preserves binary attachments and base64-encoded attached messages', async () => {
    const binary = Buffer.from([0, 127, 128, 255]);
    const attachedMail = 'From: nested@example.com\r\nSubject: Nested\r\n\r\nNested body';
    const parsed = await commonParseMail({ rawEmail: [
      'From: Sender <first@example.com>', 'Subject: Attachments', 'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary=test', '',
      '--test', 'Content-Type: text/html; charset=utf-8', '', '<p>正文</p>',
      '--test', 'Content-Type: image/png', "Content-Disposition: attachment; filename*=utf-8''%E5%9B%BE.png",
      'Content-Transfer-Encoding: base64', '', binary.toString('base64'),
      '--test', 'Content-Type: message/rfc822', 'Content-Disposition: attachment; filename="forward.eml"',
      'Content-Transfer-Encoding: base64', '', Buffer.from(attachedMail).toString('base64'), '--test--',
    ].join('\r\n') });
    expect(parsed?.html).toContain('<p>正文</p>');
    expect(parsed?.attachments?.map(file => file.filename)).toEqual(['图.png', 'forward.eml']);
    expect(parsed?.attachments?.[0].content).toEqual(new Uint8Array(binary));
    expect(new TextDecoder().decode(parsed?.attachments?.[1].content)).toBe(attachedMail);
  });
});

for (const flag of ['REMOVE_ALL_ATTACHMENT', 'REMOVE_EXCEED_SIZE_ATTACHMENT']) {
  for (const kind of ['plain', 'html', 'both']) {
    test(`Attachment removal round trip: ${flag}, ${kind}`, async () => {
      const context = { rawEmail: [
        'From: First <first@example.com>', 'From: Last <last@example.com>', 'Subject: Round trip',
        'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary=test', '',
        ...(kind !== 'html' ? ['--test', 'Content-Type: text/plain; charset=utf-8', '', '正文 "quoted" \\path $&'] : []),
        ...(kind !== 'plain' ? ['--test', 'Content-Type: text/html; charset=utf-8', '', '<p>正文</p>'] : []),
        '--test', 'Content-Type: application/octet-stream', 'Content-Disposition: attachment; filename="file.bin"',
        'Content-Transfer-Encoding: base64', '', 'AH+A/w==', '--test--',
      ].join('\r\n') };
      const original = await commonParseMail(context);
      expect(original?.attachments).toHaveLength(1);
      await remove_attachment_if_need({ [flag]: true } as unknown as Bindings, context,
        'bounce@transport.example', 'recipient@example.com', 2 * 1024 * 1024);
      const stored = await commonParseMail({ rawEmail: context.rawEmail });
      expect(stored?.sender).toBe('First <first@example.com>');
      expect(stored?.subject).toBe('Round trip');
      expect(stored?.text.trim()).toBe(original?.text.trim());
      expect(stored?.html.trim()).toBe(original?.html.trim());
      expect(stored?.attachments).toEqual([]);
    });
  }
}

for (const encoding of ['base64', 'quoted-printable']) {
  test(`Attachment removal regenerates MIME encoding: ${encoding}`, async () => {
    const context = { rawEmail: [
      'From: Sender <first@example.com>', 'Subject: Encoding', 'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8', `Content-Transfer-Encoding: ${encoding}`, '',
      encoding === 'base64' ? Buffer.from('正文 "quoted" \\path $&').toString('base64')
        : '=E6=AD=A3=E6=96=87 "quoted" \\path $&',
    ].join('\r\n') };
    await remove_attachment_if_need({ REMOVE_ALL_ATTACHMENT: true } as unknown as Bindings, context,
      'bounce@transport.example', 'recipient@example.com', context.rawEmail.length);
    const stored = await commonParseMail({ rawEmail: context.rawEmail });
    expect(stored?.text.trim()).toBe('正文 "quoted" \\path $&');
    expect(stored?.headers?.filter(header => header.key === 'content-type')).toHaveLength(1);
    expect(stored?.headers?.filter(header => header.key === 'content-transfer-encoding')).toHaveLength(1);
  });
}
