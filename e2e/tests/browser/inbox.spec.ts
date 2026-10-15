import { test, expect, type Locator } from '@playwright/test';
import {
  FRONTEND_URL,
  WORKER_URL,
  createTestAddress,
  seedTestMail,
  deleteAddress,
} from '../../fixtures/test-helpers';
import { request as apiRequest } from '@playwright/test';

const textContrast = (locator: Locator) => locator.evaluate(element => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d')!;
  const rgba = (color: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const blend = (color: number[], background: number[]) => color.slice(0, 3)
    .map((value, index) => value * color[3] + background[index] * (1 - color[3]));
  const ancestors: Element[] = [];
  for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
  const background = ancestors.reduce((color, node) =>
    blend(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
  const foreground = blend(rgba(getComputedStyle(element).color), background);
  const luminance = (color: number[]) => color.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
});

test('mail colors stay readable in light and dark themes and preserve selection on hover', async ({ page }) => {
  const api = await apiRequest.newContext();
  const mailbox = await createTestAddress(api, 'mail-colors');
  try {
    await seedTestMail(api, mailbox.address, { subject: 'Color check one', text: 'Readable preview one.' });
    await seedTestMail(api, mailbox.address, { subject: 'Color check two', text: 'Readable preview two.' });
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.goto(`${FRONTEND_URL}/en/`);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => {
        localStorage.setItem('vueuse-color-scheme', value);
        localStorage.setItem('mailListView', 'false');
        localStorage.setItem('mailListPreviewLineClamp', '1');
      }, theme);
      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      const items = page.getByRole('listitem').filter({ has: page.locator('.mail-summary') });
      await expect(items).toHaveCount(2);
      await page.mouse.move(0, 0);
      const selected = page.locator('.n-list-item.overlay');
      const selectedColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
      await expect(selected).toHaveCSS('background-color', selectedColor);
      for (const item of [items.first(), items.last()]) {
        expect(await textContrast(item.locator('.mail-summary-preview .n-text'))).toBeGreaterThanOrEqual(4.5);
        expect(await textContrast(item.locator('.mail-summary-date'))).toBeGreaterThanOrEqual(4.5);
      }
      const reader = page.locator('.mail-content-renderer');
      for (const name of ['Reply', 'Forward', 'More actions', 'Delete']) {
        const button = reader.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        expect(await textContrast(button)).toBeGreaterThanOrEqual(4.5);
        await button.hover();
        await expect(button).toHaveCSS('background-color', theme === 'dark'
          ? 'rgba(255, 255, 255, 0.12)' : 'rgba(46, 51, 56, 0.09)');
        expect(await textContrast(button)).toBeGreaterThanOrEqual(4.5);
      }
      const unselected = page.locator('.n-list-item:not(.overlay)');
      await unselected.hover();
      await expect(unselected).toHaveCSS('background-color', theme === 'dark'
        ? 'rgba(255, 255, 255, 0.04)' : 'rgb(243, 243, 245)');
      expect(await textContrast(unselected.locator('.mail-summary-preview .n-text'))).toBeGreaterThanOrEqual(4.5);
      await selected.hover();
      await expect(selected).toHaveCSS('background-color', selectedColor);
    }
  } finally {
    try {
      await deleteAddress(api, mailbox.jwt);
    } finally {
      await api.dispose();
    }
  }
});

test.describe('Inbox Browser Flow', () => {
  test('login via JWT, view inbox, open email', async ({ page }) => {
    // Create API context for setup
    const api = await apiRequest.newContext();
    let jwt: string | undefined;

    try {
      const created = await createTestAddress(api, 'inbox-browser');
      jwt = created.jwt;
      const address = created.address;

      // Seed an email
      const subject = `Browser Test ${Date.now()}`;
      await seedTestMail(api, address, {
        subject,
        html: '<h1>Welcome</h1><p>This is a <b>browser test</b> email.</p>',
      });

      // Login via JWT query param with /en/ path to force English locale
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);

      // The mail subject should be visible in the inbox list item
      const mailItem = page.getByRole('listitem').getByText(subject);
      await expect(mailItem).toBeVisible({ timeout: 10_000 });

      // Click to open the email
      await mailItem.click();

      // Verify the email detail panel shows the subject as a heading
      // (n-card-header wraps n-card-header__main, both match heading role — use .first())
      await expect(page.getByRole('heading', { name: subject }).first()).toBeVisible({ timeout: 5_000 });
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });
});

for (const layout of [
  { name: 'desktop split', width: 1360, listView: false },
  { name: 'desktop list', width: 1360, listView: true },
  { name: 'mobile', width: 390, listView: false },
  { name: 'narrow mobile', width: 320, listView: false },
]) {
  test(`mail summaries and reader remain usable on ${layout.name}`, async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt: string | undefined;
    try {
      const mailbox = await createTestAddress(api, 'mail-layout');
      jwt = mailbox.jwt;
      const subject = `Responsive mail ${Date.now()} with a long subject for the compact list`;
      const text = 'A body preview that remains readable without emphasizing sender or recipient addresses.';
      const from = 'long.sender.address.for.responsive.layout@test.example.com';
      await seedTestMail(api, mailbox.address, { subject, text, from });

      await page.setViewportSize({ width: layout.width, height: 900 });
      await page.goto(`${FRONTEND_URL}/en/`);
      await page.evaluate(({ listView }) => {
        localStorage.setItem('mailListView', String(listView));
        localStorage.setItem('mailListPreviewLineClamp', '1');
        localStorage.setItem('useUTCDate', 'true');
        localStorage.setItem('mailboxSplitSize', '0.25');
      }, layout);
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);

      const item = page.getByRole('listitem').filter({ hasText: subject });
      await expect(item.locator('.mail-summary-subject')).toHaveText(subject, { timeout: 10_000 });
      await expect(item.locator('.mail-summary-preview')).toHaveText(text);
      await expect(item.locator('.mail-summary-sender')).toContainText(from);
      await expect(item.locator('.mail-summary-sender')).not.toContainText('From:');
      await expect(item.locator('.mail-summary-recipient')).toHaveCount(0);
      await expect(item.locator('.mail-summary-sender .n-text').last()).toHaveCSS('font-size', '13px');
      await expect(item.locator('.mail-summary-subject .n-text')).toHaveCSS('font-size', '15px');
      expect(await item.locator('.mail-summary-subject .n-text').evaluate(element => Number(getComputedStyle(element).fontWeight)))
        .toBeGreaterThan(await item.locator('.mail-summary-sender .n-text').last().evaluate(element => Number(getComputedStyle(element).fontWeight)));
      expect(await item.locator('.mail-summary-sender .n-text').last().evaluate(element => getComputedStyle(element).color))
        .not.toBe(await item.locator('.mail-summary-subject .n-text').evaluate(element => getComputedStyle(element).color));
      expect(await item.evaluate(element => {
        const sender = element.querySelector('.mail-summary-sender')!;
        const subject = element.querySelector('.mail-summary-subject')!;
        const preview = element.querySelector('.mail-summary-preview')!;
        return Boolean(sender.compareDocumentPosition(subject) & Node.DOCUMENT_POSITION_FOLLOWING)
          && Boolean(subject.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING);
      })).toBe(true);
      await expect(item.locator('.mail-summary-date')).toHaveText(/\d{2}\/\d{2}\/\d{2}/);
      await expect(item.locator('.mail-summary-date')).toHaveAttribute('title', /UTC/);
      expect(await item.locator('.mail-summary-date').evaluate(element =>
        element.scrollWidth <= element.clientWidth + 1
      )).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await item.locator('.mail-summary-subject').click();
      const reader = page.locator('.mail-content-renderer');
      await expect(reader.locator('.mail-address-label').first()).toHaveText('From');
      await expect(reader.locator('.mail-details')).toContainText(from);
      await expect(reader.locator('.mail-details-footer')).toContainText('UTC');
      await expect(reader.locator('.mail-details-footer')).not.toContainText('ID:');
      await expect(reader.locator('.mail-details .n-tag')).toHaveCount(0);
      const reply = reader.getByRole('button', { name: 'Reply', exact: true });
      await expect(reply).toHaveClass(/n-button--info-type/);
      await expect(reply).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      expect(await textContrast(reply)).toBeGreaterThanOrEqual(4.5);
      await expect(reader.getByRole('button', { name: 'Forward', exact: true })).toHaveClass(/n-button--default-type/);
      const more = reader.getByRole('button', { name: 'More actions', exact: true });
      await expect(more).toHaveText('More');
      await expect(more).toHaveClass(/n-button--default-type/);
      await expect(more).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const remove = reader.getByRole('button', { name: 'Delete', exact: true });
      await expect(remove).toHaveText('Delete');
      await expect(remove).toHaveClass(/n-button--error-type/);
      await expect(remove).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await more.focus();
      await page.keyboard.press('Enter');
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      const download = page.getByRole('link', { name: 'Download Mail' });
      await expect(download).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Mark as Unread', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Show Text Mail', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Mail details', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      await expect(more).toBeFocused();
      await page.keyboard.press('Space');
      await expect(download).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(more).toBeFocused();
      await more.click();
      await expect(download).toBeFocused();
      await page.getByRole('button', { name: 'Mail details', exact: true }).click();
      const details = page.locator('.mail-details-modal');
      await expect(details).toBeVisible();
      await expect(details.getByRole('heading', { name: 'Mail details', exact: true }).first()).toBeVisible();
      await expect(details).toContainText('ID');
      await expect(details).toContainText(from);
      await expect(details).toContainText(subject);
      await expect(details).toContainText('Message-ID');
      await expect(details).toContainText('UTC');
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(details).toHaveCount(0);
      await expect(more).toBeFocused();
      await expect(reader.locator('.mail-details-footer')).not.toContainText('ID:');
      await more.click();
      await page.getByRole('button', { name: 'Show Text Mail', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(reader.locator('.mail-text')).toHaveText(text);
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      await expect(more).toBeFocused();
      await more.click();
      await page.getByRole('button', { name: 'Show HTML Mail', exact: true }).click();
      await expect(reader.locator('.mail-html')).toBeVisible();
      await more.click();
      await expect(download).toHaveAttribute('download', /\.eml$/);
      await expect(download).toHaveAttribute('href', /^blob:/);
      const downloaded = page.waitForEvent('download');
      await download.click();
      expect((await downloaded).suggestedFilename()).toMatch(/\.eml$/);
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      await more.click();
      await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
      await expect(page.locator('.fullscreen-mail-content')).toBeVisible();
      await page.locator('.n-drawer-header__close').last().click();
      await expect(page.locator('.fullscreen-mail-content')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      if (layout.width >= 768) {
        await page.getByRole('button', { name: 'Multi Action', exact: true }).click();
        const checkbox = item.getByRole('checkbox');
        await checkbox.click();
        await expect(checkbox).toBeChecked();
        await checkbox.click();
        await expect(checkbox).not.toBeChecked();
      }

      await page.goto(`${FRONTEND_URL}/zh/?jwt=${jwt}`);
      await item.locator('.mail-summary-subject').click();
      await page.getByRole('button', { name: '更多操作', exact: true }).click();
      await page.getByRole('button', { name: '邮件详情', exact: true }).click();
      await expect(details.getByRole('heading', { name: 'Mail details', exact: true }).first()).toBeVisible();
      expect(await details.locator('.n-descriptions-table-content__label').allTextContents()).toEqual(
        expect.arrayContaining(['Subject:', 'From:', 'Received at:', 'Message-ID:', 'ID:'])
      );
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });
}

for (const layout of [
  { name: 'narrow mobile', width: 320 },
  { name: 'narrow desktop split', width: 1360 },
]) {
  test(`mail previews constrain long links and preserve preferences on ${layout.name}`, async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt: string | undefined;
    try {
      const mailbox = await createTestAddress(api, 'preview-overflow');
      jwt = mailbox.jwt;
      const subject = `Preview overflow ${Date.now()}`;
      const link = `https://example.test/message?token=${'a'.repeat(600)}`;
      await seedTestMail(api, mailbox.address, { subject, text: `邮件正文预览 A short introduction.\n\n${link}` });
      await page.setViewportSize({ width: layout.width, height: 900 });
      await page.addInitScript(() => {
        localStorage.setItem('mailListView', 'false');
        localStorage.setItem('mailboxSplitSize', '0.2');
      });
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);
      const item = page.getByRole('listitem').filter({ hasText: subject });
      const preview = item.locator('.mail-summary-preview');
      const ellipsis = preview.locator('.n-ellipsis');
      await expect(ellipsis).toHaveCSS('-webkit-line-clamp', '1');
      await expect(item).toHaveCSS('padding', '12px 14px');
      await expect(item.locator('.mail-summary-subject')).toHaveCSS('margin-top', '4px');
      await expect(preview).toHaveCSS('margin-top', '8px');
      if (layout.width > 768) {
        await expect(page.locator('.n-split')).toBeVisible();
        await expect(page.locator('.mail-content-renderer')).toBeVisible();
        expect(await page.locator('.mail-list-scroll').evaluate(element => element.getBoundingClientRect().width))
          .toBeLessThan(320);
      }

      for (const lines of [1, 2, 5, 0]) {
        if (lines !== 1) {
          await page.evaluate(value => localStorage.setItem('mailListPreviewLineClamp', String(value)), lines);
          await page.reload();
        }
        await expect(item.locator('.mail-summary-subject')).toHaveText(subject);
        expect(await page.evaluate(() => localStorage.getItem('mailListPreviewLineClamp'))).toBe(String(lines));
        if (lines === 0) {
          await expect(preview).toHaveCount(0);
          continue;
        }
        await expect(ellipsis).toBeVisible();
        await expect(ellipsis).toHaveCSS('-webkit-line-clamp', String(lines));
        await expect(preview).toContainText(link);
        const bounds = await ellipsis.evaluate(element => ({
          width: element.getBoundingClientRect().width,
          availableWidth: element.parentElement!.clientWidth,
          scrollWidth: element.scrollWidth,
          height: element.getBoundingClientRect().height,
          lineHeight: parseFloat(getComputedStyle(element).lineHeight),
        }));
        expect(bounds.width).toBeLessThanOrEqual(bounds.availableWidth + 1);
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.availableWidth + 1);
        expect(bounds.height).toBeCloseTo(bounds.lineHeight * lines, 0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });
}

test('attachment action keeps its label, count and downloads on narrow mobile', async ({ page }) => {
  const api = await apiRequest.newContext();
  let jwt: string | undefined;
  try {
    const mailbox = await createTestAddress(api, 'attachment-layout');
    jwt = mailbox.jwt;
    const subject = `Attachment layout ${Date.now()}`;
    const boundary = `attachment-${Date.now()}`;
    const raw = [
      'From: Reports Team <sender@test.example.com>',
      `To: ${mailbox.address}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Two attachments for the responsive reader.',
      ...['report.txt', 'summary.csv'].flatMap(filename => [
        `--${boundary}`,
        'Content-Type: application/octet-stream',
        `Content-Disposition: attachment; filename="${filename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(`Content of ${filename}`).toString('base64'),
      ]),
      `--${boundary}--`,
    ].join('\r\n');
    const seeded = await api.post(`${WORKER_URL}/__test/receive_mail`, {
      data: { from: 'sender@test.example.com', to: mailbox.address, raw },
    });
    expect(seeded.ok()).toBe(true);
    expect((await seeded.json()).success).toBe(true);

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);
    const item = page.getByRole('listitem').filter({ hasText: subject });
    const sender = item.locator('.mail-summary-sender');
    await expect(sender).toContainText('Reports Team');
    await expect(sender).toContainText('sender@test.example.com');
    await expect(sender).toHaveAttribute('title', /sender@test\.example\.com/);
    await item.getByText(subject).click();
    const attachments = page.getByRole('button', { name: 'Attachments', exact: true });
    await expect(attachments).toContainText('Attachments');
    await expect(attachments.locator('.n-badge-sup')).toHaveAttribute('title', '2');
    await expect(attachments.locator('.n-base-slot-machine-current-number')).toHaveText('2');
    await expect(attachments).not.toContainText('(');
    await expect(attachments).toHaveClass(/n-button--default-type/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await attachments.click();
    const dialog = page.locator('.n-dialog[role="dialog"]');
    await expect(dialog).toContainText('report.txt');
    await expect(dialog).toContainText('summary.csv');
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('link').first().click();
    expect((await downloaded).suggestedFilename()).toBe('report.txt');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.goto(`${FRONTEND_URL}/zh/?jwt=${jwt}`);
    await page.getByRole('listitem').getByText(subject).click();
    const localizedAttachments = page.getByRole('button', { name: '附件', exact: true });
    await expect(localizedAttachments).toContainText('附件');
    await expect(localizedAttachments.locator('.n-badge-sup')).toHaveAttribute('title', '2');
    for (const theme of ['dark', 'light']) {
      await page.evaluate(value => localStorage.setItem('vueuse-color-scheme', value), theme);
      await page.reload();
      await page.getByRole('listitem').getByText(subject).click();
      const badge = localizedAttachments.locator('.n-badge-sup');
      await expect(badge).toHaveCSS('color', theme === 'dark'
        ? 'rgba(255, 255, 255, 0.82)' : 'rgb(51, 54, 57)');
      expect(await textContrast(badge)).toBeGreaterThanOrEqual(4.5);
      expect(await textContrast(localizedAttachments)).toBeGreaterThanOrEqual(4.5);
      await localizedAttachments.hover();
      await expect(localizedAttachments).toHaveCSS('background-color', theme === 'dark'
        ? 'rgba(255, 255, 255, 0.12)' : 'rgba(46, 51, 56, 0.09)');
      expect(await textContrast(localizedAttachments)).toBeGreaterThanOrEqual(4.5);
    }
  } finally {
    try {
      if (jwt) await deleteAddress(api, jwt);
    } finally {
      await api.dispose();
    }
  }
});

for (const width of [1360, 320]) {
  test(`admin summaries distinguish sender and recipient at ${width}px`, async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt: string | undefined;
    try {
      const mailbox = await createTestAddress(api, 'admin-summary');
      jwt = mailbox.jwt;
      const subject = `Admin summary ${Date.now()}`;
      const from = 'sender@test.example.com';
      await seedTestMail(api, mailbox.address, { subject, from });
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        localStorage.setItem('adminAuth', 'e2e-admin-pass');
        sessionStorage.setItem('adminTab', 'mails');
      });
      for (const labels of [
        { locale: 'en', from: 'From', to: 'To' },
        { locale: 'zh', from: '发件人', to: '收件人' },
      ]) {
        await page.goto(`${FRONTEND_URL}/${labels.locale}/admin`);
        const item = page.getByRole('listitem').filter({ hasText: subject });
        await expect(item.locator('.mail-summary-sender')).toHaveText(`${labels.from}: ${from}`);
        await expect(item.locator('.mail-summary-recipient')).toHaveText(`${labels.to}: ${mailbox.address}`);
        await expect(item.locator('.mail-summary-recipient')).toHaveCSS('margin-top', '4px');
        expect(await item.evaluate(element => {
          const sender = element.querySelector('.mail-summary-sender')!;
          const recipient = element.querySelector('.mail-summary-recipient')!;
          const subject = element.querySelector('.mail-summary-subject')!;
          return Boolean(sender.compareDocumentPosition(recipient) & Node.DOCUMENT_POSITION_FOLLOWING)
            && Boolean(recipient.compareDocumentPosition(subject) & Node.DOCUMENT_POSITION_FOLLOWING);
        })).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });
}
