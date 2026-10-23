import { expect, test, type Page } from '@playwright/test';
import { FRONTEND_URL, WORKER_URL, createTestAddress, seedTestMail } from '../../fixtures/test-helpers';

const settings = { enabled: true, url: 'https://example.invalid/webhook', method: 'POST', headers: '{}', body: '{}' };
const expression = { operator: 'and', children: [
  { field: 'subject', operator: 'regex', value: '^DOWN', options: { flags: 'i' } },
  { operator: 'not', children: [{ field: 'text', operator: 'contains', value: 'maintenance' }] },
] };

const adminLabels: Record<string, { mails: string; webhook: string; condition: string }> = {
  zh: { mails: '邮件', webhook: '邮件 Webhook', condition: '匹配条件' },
  en: { mails: 'Emails', webhook: 'Mail Webhook', condition: 'Condition' },
  es: { mails: 'Correos', webhook: 'Webhook de correo', condition: 'Condición' },
  'pt-BR': { mails: 'E-mails', webhook: 'Webhook de e-mail', condition: 'Condição' },
  ja: { mails: 'メール', webhook: 'メールWebhook', condition: '条件' },
  de: { mails: 'E-Mails', webhook: 'Mail-Webhook', condition: 'Bedingung' },
};

async function openAdminWebhook(page: Page, locale = 'zh') {
  const { mails, webhook } = adminLabels[locale];
  await page.goto(`${FRONTEND_URL}/${locale}/admin`);
  await page.getByText(mails, { exact: true }).click();
  await page.getByText(webhook, { exact: true }).click();
}

test('Webhook configures the generic editor with server-supported fields and operators', async ({ page, request }) => {
  test.setTimeout(60_000);
  const endpoint = `${WORKER_URL}/admin/mail_webhook/settings`;
  const previous = await (await request.get(endpoint)).json();
  const mailbox = await createTestAddress(request, 'filterconfig');
  const initial = { field: 'subject', operator: 'equals', value: 'DOWN' };
  try {
    expect((await request.post(endpoint, { data: { enabled: false } })).ok()).toBe(true);
    await seedTestMail(request, mailbox.address, { subject: 'DOWN', from: 'review@example.com' });
    const headers = { Authorization: `Bearer ${mailbox.jwt}` };
    const mails = await (await request.get(`${WORKER_URL}/api/mails?limit=1&offset=0`, { headers })).json();
    expect((await request.post(endpoint, { data: { ...settings, filter: initial } })).ok()).toBe(true);
    await openAdminWebhook(page, 'en');
    const editor = page.getByTestId('filter-editor').first();
    const operator = editor.locator('[aria-label="Operator"]');
    const field = editor.locator('[aria-label="Field"]');
    const labels = ['Equals', 'Contains', 'Starts with', 'Ends with'].flatMap(label => [label, `${label} (Case sensitive)`]);
    labels.push('Regular expression');
    await operator.click();
    await expect(page.locator('.n-base-select-option__content:visible')).toHaveText(labels);
    await page.keyboard.press('Escape');
    await field.click();
    const fieldLabels = ['Sender', 'Delivery address', 'Subject', 'Plain text', 'HTML body'];
    await expect(page.locator('.n-base-select-option__content:visible')).toHaveText(fieldLabels);
    await page.keyboard.press('Escape');
    const openCheck = page.locator('#app').getByRole('button', { name: 'Check only', exact: true });
    await openCheck.click();
    await page.getByRole('dialog').getByText('Specify ID', { exact: true }).click();
    await page.getByRole('dialog').getByPlaceholder('Email ID', { exact: true }).fill(String(mails.results[0].id));
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    const saveAndCheck = async () => {
      const saved = page.waitForResponse(res => res.url().endsWith('/admin/mail_webhook/settings') && res.request().method() === 'POST');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      expect((await saved).status()).toBe(200);
      await openCheck.click();
      const checked = page.waitForResponse(res => res.url().endsWith('/admin/mail_webhook/check_filter'));
      await page.getByRole('dialog').getByRole('button', { name: 'Check only', exact: true }).click();
      expect(await (await checked).json()).toEqual({ success: true, matched: true });
      await expect(page.getByRole('dialog')).toHaveCount(0);
    };
    for (const label of labels) {
      await operator.click();
      await page.locator('.n-base-select-option:visible').getByText(label, { exact: true }).click();
      await saveAndCheck();
    }
    await operator.click();
    await page.locator('.n-base-select-option:visible').getByText('Contains', { exact: true }).click();
    for (const [index, value] of ['review@example.com', mailbox.address, 'DOWN', 'Hello from E2E', 'Hello from E2E'].entries()) {
      await field.click();
      await page.locator('.n-base-select-option:visible').getByText(fieldLabels[index], { exact: true }).click();
      await editor.getByRole('textbox', { name: 'Value', exact: true }).fill(value);
      await saveAndCheck();
    }
  } finally {
    expect((await request.post(endpoint, { data: previous })).ok()).toBe(true);
    await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
  }
});

for (const [operator, label] of [['equals', '等于'], ['contains', '包含'], ['startsWith', '开头匹配'], ['endsWith', '结尾匹配']]) {
  test(`Case-sensitive operator selection round-trips JSON: ${operator}`, async ({ page }) => {
    const original = { field: 'subject', operator: `${operator}CaseSensitive`, value: 'DOWN' };
    const saved: any[] = [];
    await page.route('**/admin/mail_webhook/settings', route => {
      if (route.request().method() === 'POST') saved.push(route.request().postDataJSON());
      return route.fulfill({ json: route.request().method() === 'POST' ? { success: true } : { ...settings, filter: original } });
    });
    await openAdminWebhook(page);
    const editor = page.getByTestId('filter-editor').first();
    const selector = editor.locator('[aria-label="操作符"]');
    const sensitiveLabel = `${label} (区分大小写)`;
    await expect(selector).toContainText(sensitiveLabel);
    await expect(editor.getByRole('checkbox', { name: '区分大小写' })).toHaveCount(0);
    const save = page.getByRole('button', { name: '保存', exact: true });
    await save.click();
    await expect.poll(() => saved.at(-1)?.filter).toEqual(original);
    await selector.click();
    await page.locator('.n-base-select-option').getByText(label, { exact: true }).click();
    await save.click();
    await expect.poll(() => saved.at(-1)?.filter).toEqual({ field: 'subject', operator, value: 'DOWN' });
    await selector.click();
    await page.locator('.n-base-select-option').getByText(sensitiveLabel, { exact: true }).click();
    await save.click();
    await expect.poll(() => saved.at(-1)?.filter).toEqual(original);
    await editor.getByText('JSON', { exact: true }).click();
    expect(JSON.parse(await editor.getByRole('textbox', { name: 'JSON', exact: true }).inputValue())).toEqual(original);
    await editor.getByText('可视化', { exact: true }).click();
    await expect(selector).toContainText(sensitiveLabel);
  });
}

test('Rule checking and legacy delivery use separate dialogs, requests and mail selections', async ({ page }, testInfo) => {
  const saved: any[] = [];
  const tested: any[] = [];
  const checked: any[] = [];
  await page.route('**/admin/mail_webhook/settings', route => {
    if (route.request().method() === 'POST') saved.push(route.request().postDataJSON());
    return route.fulfill({ json: route.request().method() === 'POST' ? { success: true } : settings });
  });
  await page.route('**/admin/mail_webhook/test', route => {
    tested.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true } });
  });
  await page.route('**/admin/mail_webhook/check_filter', route => {
    checked.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, matched: false } });
  });
  await openAdminWebhook(page);
  const editor = page.getByTestId('filter-editor').first();
  await editor.locator('[aria-label="规则类型"]').click();
  await page.locator('.n-base-select-option:visible').getByText('与：全部满足', { exact: true }).click();
  const children = editor.locator(':scope > .filter-editor');
  await expect(children).toHaveCount(2);
  for (const child of await children.all()) {
    await expect(page.locator('.n-base-select-option:visible')).toHaveCount(0);
    await child.locator('[aria-label="规则类型"]').click();
    await page.locator('.n-base-select-option:visible').getByText('匹配条件', { exact: true }).click();
    await expect(page.locator('.n-base-select-option:visible')).toHaveCount(0);
    await child.locator('[aria-label="字段"]').click();
    await page.locator('.n-base-select-option:visible').getByText('发件人', { exact: true }).click();
    await expect(page.locator('.n-base-select-option:visible')).toHaveCount(0);
    await child.locator('[aria-label="操作符"]').click();
    await page.locator('.n-base-select-option:visible').getByText('包含', { exact: true }).click();
  }
  await editor.getByPlaceholder('匹配值', { exact: true }).first().fill('@example.com');
  expect(await editor.locator('input[placeholder="匹配值"]').count()).toBe(2);
  await editor.getByText('JSON', { exact: true }).click();
  const json = editor.getByRole('textbox', { name: 'JSON', exact: true });
  const visual = JSON.parse(await json.inputValue());
  expect(visual.operator).toBe('and');
  expect(visual.children).toHaveLength(2);
  expect(visual.children[0].value).toBe('@example.com');
  await json.fill('{');
  const save = page.getByRole('button', { name: '保存', exact: true });
  await expect(save).toBeDisabled();
  await json.fill(JSON.stringify(expression));
  await expect(save).toBeEnabled();
  await editor.getByText('可视化', { exact: true }).click();
  await expect(editor.getByPlaceholder('匹配值', { exact: true }).first()).toHaveValue('^DOWN');
  await save.click();
  expect(saved.at(-1).filter).toEqual(expression);
  await expect(page.getByText('成功', { exact: true })).toBeVisible();
  const openTest = page.locator('#app').getByRole('button', { name: '测试', exact: true });
  const openCheck = page.locator('#app').getByRole('button', { name: '仅检查规则', exact: true });
  await openCheck.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: '测试', exact: true })).toHaveCount(0);
  await expect(page.locator('.n-message')).toHaveCount(0);
  await testInfo.attach('Independent rule check dialog', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await page.getByRole('dialog').getByRole('button', { name: '仅检查规则', exact: true }).click();
  await expect(page.getByText('条件不匹配，未发送 Webhook', { exact: true })).toBeVisible();
  expect(checked.at(-1)).toEqual({ filter: expression });
  expect(tested).toHaveLength(0);
  const urlInput = page.locator('.n-form-item').filter({ has: page.getByText('URL', { exact: true }) }).getByRole('textbox');
  await urlInput.fill('');
  await openCheck.click();
  await page.getByRole('dialog').getByText('指定 ID', { exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '仅检查规则', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(checked).toHaveLength(1);
  await page.getByRole('dialog').getByPlaceholder('邮件 ID', { exact: true }).fill('123');
  await page.getByRole('dialog').getByRole('button', { name: '仅检查规则', exact: true }).click();
  await expect.poll(() => checked.at(-1)).toEqual({ filter: expression, mail_id: 123 });
  expect(tested).toHaveLength(0);
  await urlInput.fill(settings.url);
  await openTest.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: '仅检查规则', exact: true })).toHaveCount(0);
  await expect(page.locator('.n-message')).toHaveCount(0);
  await testInfo.attach('Unchanged delivery test dialog', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await expect(page.getByRole('dialog').getByPlaceholder('邮件 ID', { exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: '测试', exact: true }).click();
  expect(tested.at(-1)).toMatchObject({ filter: expression });
  expect(tested.at(-1)).not.toHaveProperty('mail_id');
  expect(checked).toHaveLength(2);
  await editor.getByRole('button', { name: '移除', exact: true }).first().click();
  await save.click();
  expect(saved.at(-1).filter).toBeNull();
});

test('Four node types share one selector with fixed slots and recursive nesting', async ({ page }) => {
  const saved: any[] = [];
  await page.route('**/admin/mail_webhook/settings', route => {
    if (route.request().method() === 'POST') saved.push(route.request().postDataJSON());
    return route.fulfill({ json: route.request().method() === 'POST' ? { success: true } : settings });
  });
  await openAdminWebhook(page);
  const editor = page.getByTestId('filter-editor').first();
  const save = page.getByRole('button', { name: '保存', exact: true });
  const choose = async (node: ReturnType<Page['locator']>, label: string) => {
    await node.locator(':scope > .node-toolbar [aria-label="规则类型"]').click();
    await expect(page.locator('.n-base-select-option__content:visible')).toHaveText([
      '匹配条件', '与：全部满足', '或：任一满足', '非：取反',
    ]);
    await page.locator('.n-base-select-option:visible').getByText(label, { exact: true }).click();
  };
  const fill = async (node: ReturnType<Page['locator']>, field: string, value: string) => {
    await choose(node, '匹配条件');
    await expect(save).toBeDisabled();
    await node.locator('[aria-label="字段"]').click();
    await page.locator('.n-base-select-option:visible').getByText(field, { exact: true }).click();
    await node.locator('[aria-label="操作符"]').click();
    await page.locator('.n-base-select-option:visible').getByText('包含', { exact: true }).click();
    await node.getByPlaceholder('匹配值', { exact: true }).fill(value);
  };
  await fill(editor, '主题', 'DOWN');
  await save.click();
  await expect.poll(() => saved.at(-1)?.filter).toEqual({ field: 'subject', operator: 'contains', value: 'DOWN' });
  await choose(editor, '与：全部满足');
  const slots = editor.locator(':scope > .filter-editor');
  await expect(slots).toHaveCount(2);
  await expect(save).toBeDisabled();
  await fill(slots.nth(0), '主题', 'DOWN');
  await choose(slots.nth(1), '或：任一满足');
  const inner = slots.nth(1).locator(':scope > .filter-editor');
  await expect(inner).toHaveCount(2);
  await fill(inner.nth(0), '发件人', '@example.com');
  await choose(inner.nth(1), '非：取反');
  const negated = inner.nth(1).locator(':scope > .filter-editor');
  await expect(negated).toHaveCount(1);
  await fill(negated, '纯文本正文', 'maintenance');
  await expect(save).toBeEnabled();
  await save.click();
  const nested = { operator: 'and', children: [
    { field: 'subject', operator: 'contains', value: 'DOWN' },
    { operator: 'or', children: [
      { field: 'from', operator: 'contains', value: '@example.com' },
      { operator: 'not', children: [{ field: 'text', operator: 'contains', value: 'maintenance' }] },
    ] },
  ] };
  await expect.poll(() => saved.at(-1)?.filter).toEqual(nested);
  await choose(editor, '或：任一满足');
  await save.click();
  await expect.poll(() => saved.at(-1)?.filter).toEqual({ ...nested, operator: 'or' });
  await slots.nth(0).getByRole('button', { name: '移除', exact: true }).click();
  await expect(slots).toHaveCount(2);
  await expect(save).toBeDisabled();
  await editor.getByRole('button', { name: '移除', exact: true }).first().click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => saved.at(-1)?.filter).toBeNull();
  await expect(editor.getByRole('button', { name: '包入条件组', exact: true })).toHaveCount(0);
  await expect(editor.getByRole('button', { name: '添加条件', exact: true })).toHaveCount(0);
});

test('Rule check errors and loading state never affect legacy delivery tests', async ({ page }) => {
  const checked: any[] = [];
  const sent: any[] = [];
  let release: (() => void) | undefined;
  await page.route('**/admin/mail_webhook/settings', route => route.fulfill({ json: { ...settings, filter: expression } }));
  await page.route('**/admin/mail_webhook/test', route => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true } });
  });
  await page.route('**/admin/mail_webhook/check_filter', async route => {
    checked.push(route.request().postDataJSON());
    if (checked.length === 1) return route.fulfill({ status: 400, body: 'Cannot evaluate filter' });
    await new Promise<void>(resolve => { release = resolve; });
    return route.fulfill({ json: { success: true, matched: true } });
  });
  try {
    await openAdminWebhook(page);
    const openCheck = page.locator('#app').getByRole('button', { name: '仅检查规则', exact: true });
    await openCheck.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('指定 ID', { exact: true }).click();
    await dialog.getByPlaceholder('邮件 ID', { exact: true }).fill('987');
    await dialog.getByRole('button', { name: '仅检查规则', exact: true }).click();
    await expect(page.getByText('[400]: Cannot evaluate filter', { exact: true })).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await page.locator('#app').getByRole('button', { name: '测试', exact: true }).click();
    await dialog.getByText('指定 ID', { exact: true }).click();
    await dialog.getByPlaceholder('邮件 ID', { exact: true }).fill('123');
    await dialog.getByRole('button', { name: '测试', exact: true }).click();
    await expect.poll(() => sent.at(-1)?.mail_id).toBe(123);
    await expect(dialog).toHaveCount(0);
    await openCheck.click();
    await expect(dialog.getByPlaceholder('邮件 ID', { exact: true })).toHaveValue('987');
    await dialog.getByRole('button', { name: '仅检查规则', exact: true }).click();
    await expect.poll(() => checked.length).toBe(2);
    await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeDisabled();
    await expect(dialog.getByPlaceholder('邮件 ID', { exact: true })).toBeDisabled();
    release!();
    await expect(dialog).toHaveCount(0);
    expect(checked).toEqual([{ filter: expression, mail_id: 987 }, { filter: expression, mail_id: 987 }]);
    expect(sent).toHaveLength(1);
  } finally {
    release?.();
  }
});

test('Invalid JSON draft does not prevent disabling the webhook', async ({ page }) => {
  const saved: any[] = [];
  await page.route('**/admin/mail_webhook/settings', route => {
    if (route.request().method() === 'POST') saved.push(route.request().postDataJSON());
    return route.fulfill({ json: route.request().method() === 'POST' ? { success: true } : { ...settings, filter: expression } });
  });
  await openAdminWebhook(page);
  const editor = page.getByTestId('filter-editor').first();
  await editor.getByText('JSON', { exact: true }).click();
  await editor.getByRole('textbox', { name: 'JSON', exact: true }).fill('{');
  const save = page.getByRole('button', { name: '保存', exact: true });
  await expect(save).toBeDisabled();
  await page.locator('.n-card').filter({ has: editor }).getByRole('switch').click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => saved.at(-1)).toMatchObject({ enabled: false, filter: expression });
});

test('Nested visual edits and failed saves never mutate the last saved filter', async ({ page }) => {
  const saved: any[] = [];
  let failSave = true;
  await page.route('**/admin/mail_webhook/settings', route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { ...settings, filter: expression } });
    saved.push(route.request().postDataJSON());
    return route.fulfill({ status: failSave ? 500 : 200, json: { success: !failSave } });
  });
  await openAdminWebhook(page);
  const editor = page.getByTestId('filter-editor').first();
  const values = editor.getByRole('textbox', { name: '匹配值', exact: true });
  const save = page.getByRole('button', { name: '保存', exact: true });
  const toggle = page.locator('.n-card').filter({ has: save }).getByRole('switch');
  await values.first().fill('^EDITED');
  await values.nth(1).fill('paused');
  const updated = { operator: 'not', children: [{ operator: 'and', children: [
    { field: 'subject', operator: 'regex', value: '^EDITED', options: { flags: 'i' } },
    { operator: 'not', children: [{ field: 'text', operator: 'contains', value: 'paused' }] },
  ] }] };
  await editor.getByText('JSON', { exact: true }).click();
  await editor.getByRole('textbox', { name: 'JSON', exact: true }).fill(JSON.stringify(updated));
  await editor.getByText('可视化', { exact: true }).click();
  const failed = page.waitForResponse(res => res.url().endsWith('/admin/mail_webhook/settings') && res.request().method() === 'POST');
  await save.click();
  expect((await failed).status()).toBe(500);
  expect(saved.at(-1).filter).toEqual(updated);
  failSave = false;
  for (const expected of [expression, updated]) {
    await values.first().fill('[');
    await expect(save).toBeEnabled();
    await toggle.click();
    await save.click();
    await expect.poll(() => saved.at(-1)).toMatchObject({ enabled: false, filter: expected });
    await toggle.click();
    await expect(save).toBeEnabled();
    await values.first().fill('^EDITED');
    await save.click();
    await expect.poll(() => saved.at(-1)).toMatchObject({ enabled: true, filter: updated });
  }
});

for (const original of [expression, null]) {
  for (const mode of ['regex', 'unknown field', 'json']) {
    test(`Invalid ${mode} draft can disable webhook with real API: ${original ? 'existing rule' : 'no rule'}`, async ({ page, request }) => {
      const endpoint = `${WORKER_URL}/admin/mail_webhook/settings`;
      const previous = await (await request.get(endpoint)).json();
      try {
        expect((await request.post(endpoint, { data: { ...settings, filter: original } })).ok()).toBe(true);
        await openAdminWebhook(page);
        const editor = page.getByTestId('filter-editor').first();
        const save = page.getByRole('button', { name: '保存', exact: true });
        const toggle = page.locator('.n-card').filter({ has: save }).getByRole('switch');
        const valid = { field: 'subject', operator: 'regex', value: '^UPDATED', options: { flags: 'i' } };
        const saveAndRead = async () => {
          const response = page.waitForResponse(res => res.url().endsWith('/admin/mail_webhook/settings') && res.request().method() === 'POST');
          await save.click();
          expect((await response).status()).toBe(200);
          return (await request.get(endpoint)).json();
        };
        for (const expectedFilter of [original, valid]) {
          await editor.getByText('JSON', { exact: true }).click();
          await editor.getByRole('textbox', { name: 'JSON', exact: true }).fill(JSON.stringify(valid));
          if (mode === 'regex') {
            await editor.getByText('可视化', { exact: true }).click();
            await editor.getByRole('textbox', { name: '匹配值', exact: true }).fill('[');
          } else {
            await editor.getByRole('textbox', { name: 'JSON', exact: true }).fill(mode === 'json' ? '{' : JSON.stringify({ ...valid, field: 'headerFrom' }));
          }
          if (mode === 'regex') {
            await expect(save).toBeEnabled();
            const response = page.waitForResponse(res => res.url().endsWith('/admin/mail_webhook/settings') && res.request().method() === 'POST');
            await save.click();
            expect((await response).status()).toBe(400);
            await expect(page.getByText(/\[400\]: 无效的过滤规则/).last()).toBeVisible();
            expect((await (await request.get(endpoint)).json()).filter ?? null).toEqual(expectedFilter);
          } else {
            await expect(save).toBeDisabled();
          }
          await toggle.click();
          await expect(save).toBeEnabled();
          expect(await saveAndRead()).toMatchObject({ enabled: false, filter: expectedFilter });
          await toggle.click();
          if (mode === 'regex') {
            await expect(save).toBeEnabled();
            await expect(editor.getByRole('textbox', { name: '匹配值', exact: true })).toHaveValue('[');
            await editor.getByRole('textbox', { name: '匹配值', exact: true }).fill('^UPDATED');
          } else {
            await expect(save).toBeDisabled();
            await expect(editor.getByRole('textbox', { name: 'JSON', exact: true })).toHaveValue(mode === 'json' ? '{' : JSON.stringify({ ...valid, field: 'headerFrom' }));
            await editor.getByRole('textbox', { name: 'JSON', exact: true }).fill(JSON.stringify(valid));
            await editor.getByText('可视化', { exact: true }).click();
          }
          await expect(save).toBeEnabled();
          expect(await saveAndRead()).toMatchObject({ enabled: true, filter: valid });
        }
      } finally {
        expect((await request.post(endpoint, { data: previous })).ok()).toBe(true);
      }
    });
  }
}

for (const scope of ['admin', 'mailbox']) {
  test(`Backend regex errors are shown without losing the draft or saved settings: ${scope}`, async ({ page, request }) => {
    test.setTimeout(60_000);
    const adminEndpoint = `${WORKER_URL}/admin/mail_webhook/settings`;
    const previous = await (await request.get(adminEndpoint)).json();
    const mailbox = await createTestAddress(request, 'regexcheck');
    const base = scope === 'admin' ? '/admin/mail_webhook' : '/api/webhook';
    const headers = { Authorization: `Bearer ${mailbox.jwt}` };
    const initial = { ...settings, filter: expression };
    try {
      expect((await request.post(adminEndpoint, { data: { enabled: false } })).ok()).toBe(true);
      await seedTestMail(request, mailbox.address, { subject: 'UP service' });
      expect((await request.post(`${WORKER_URL}${base}/settings`, { headers, data: initial })).ok()).toBe(true);
      if (scope === 'admin') {
        await openAdminWebhook(page, 'en');
      } else {
        await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
        await page.getByText('Webhook Settings', { exact: true }).click();
      }
      const editor = page.getByTestId('filter-editor').first();
      await editor.getByText('JSON', { exact: true }).click();
      const json = editor.getByRole('textbox', { name: 'JSON', exact: true });
      const save = page.getByRole('button', { name: 'Save', exact: true });
      const openCheck = page.locator('#app').getByRole('button', { name: 'Check only', exact: true });
      const valid = { field: 'subject', operator: 'regex', value: '^UP', options: { flags: 'i' } };
      const check = async (status: number) => {
        await openCheck.click();
        const response = page.waitForResponse(res => res.url().endsWith(`${base}/check_filter`));
        await page.getByRole('dialog').getByRole('button', { name: 'Check only', exact: true }).click();
        expect((await response).status()).toBe(status);
      };
      for (const filter of [
        ...['[', '(', '*a'].map(value => ({ ...valid, value })),
        ...['g', 'ii', false].map(flags => ({ ...valid, options: { flags } })),
      ]) {
        await json.fill(JSON.stringify(filter));
        await expect(save).toBeEnabled();
        await expect(openCheck).toBeEnabled();
        const response = page.waitForResponse(res => res.url().endsWith(`${base}/settings`) && res.request().method() === 'POST');
        await save.click();
        expect((await response).status()).toBe(400);
        await expect(page.getByText(/\[400\]: Invalid filter/).last()).toBeVisible();
        expect(await (await request.get(`${WORKER_URL}${base}/settings`, { headers })).json()).toEqual(initial);
        await check(400);
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/\[400\]: Invalid filter/).last()).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(json).toHaveValue(JSON.stringify(filter));
      }
      await json.fill(JSON.stringify(valid));
      const response = page.waitForResponse(res => res.url().endsWith(`${base}/settings`) && res.request().method() === 'POST');
      await save.click();
      expect((await response).status()).toBe(200);
      expect((await (await request.get(`${WORKER_URL}${base}/settings`, { headers })).json()).filter).toEqual(valid);
      // Select this test's mail explicitly, rather than depending on the random admin sample.
      const mails = await (await request.get(`${WORKER_URL}/api/mails?limit=1&offset=0`, { headers })).json();
      await openCheck.click();
      await page.getByRole('dialog').getByText('Specify ID', { exact: true }).click();
      await page.getByRole('dialog').getByPlaceholder('Email ID', { exact: true }).fill(String(mails.results[0].id));
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await check(200);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByText('Conditions match (check only; not sent)', { exact: true })).toBeVisible();
    } finally {
      expect((await request.post(adminEndpoint, { data: previous })).ok()).toBe(true);
      await request.delete(`${WORKER_URL}/admin/delete_address/${mailbox.address_id}`);
    }
  });
}

test('Invalid editor structure blocks saving and rule checking but never legacy delivery testing', async ({ page }) => {
  const saved: any[] = [];
  const tested: any[] = [];
  await page.route('**/admin/mail_webhook/settings', route => {
    if (route.request().method() === 'POST') saved.push(route.request().postDataJSON());
    return route.fulfill({ json: route.request().method() === 'POST' ? { success: true } : { ...settings, filter: expression } });
  });
  await page.route('**/admin/mail_webhook/check_filter', route => {
    tested.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, matched: true } });
  });
  const sent: any[] = [];
  await page.route('**/admin/mail_webhook/test', route => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true } });
  });
  await openAdminWebhook(page);
  const editor = page.getByTestId('filter-editor').first();
  const save = page.getByRole('button', { name: '保存', exact: true });
  const openTest = page.locator('#app').getByRole('button', { name: '测试', exact: true });
  const openCheck = page.locator('#app').getByRole('button', { name: '仅检查规则', exact: true });
  await editor.getByText('JSON', { exact: true }).click();
  const json = editor.getByRole('textbox', { name: 'JSON', exact: true });
  const leaf = { field: 'subject', operator: 'regex', value: '^DOWN', options: { flags: 'i' } };
  for (const invalid of [
    { ...leaf, field: 'headerFrom' }, { ...leaf, field: 'envelopeFrom' },
    { ...leaf, field: 'header.' }, { ...leaf, field: 'header.Bad Header' },
    { ...leaf, operator: 'unknown' }, { ...leaf, operator: 'contains' },
    { ...leaf, options: { unsupported: true } },
    ...['and', 'or'].flatMap(operator => [
      { operator, children: [leaf] }, { operator, children: [leaf, leaf, leaf] },
      { operator, children: [leaf, null] },
    ]),
    { operator: 'not', children: [leaf, leaf] }, { operator: 'not', children: [null] },
  ]) {
    await json.fill(JSON.stringify({ operator: 'or', children: [leaf, invalid] }));
    await expect(save).toBeDisabled();
    await expect(openCheck).toBeDisabled();
    await expect(openTest).toBeEnabled();
  }
  await openTest.click();
  await page.getByRole('dialog').getByRole('button', { name: '测试', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  await expect.poll(() => page.getByRole('dialog').count()).toBe(0);
  expect(saved).toHaveLength(0);
  expect(tested).toHaveLength(0);
  await json.fill(JSON.stringify(leaf));
  await editor.getByText('可视化', { exact: true }).click();
  const value = editor.getByRole('textbox', { name: '匹配值', exact: true });
  await value.fill('[');
  await expect(save).toBeEnabled();
  await expect(openCheck).toBeEnabled();
  await expect(value).toBeVisible();
  await value.fill('^DOWN');
  await expect(save).toBeEnabled();
  await expect(openCheck).toBeEnabled();
  await save.click();
  await expect.poll(() => saved.at(-1)?.filter).toEqual(leaf);
  await openCheck.click();
  await page.getByRole('dialog').getByRole('button', { name: '仅检查规则', exact: true }).click();
  await expect.poll(() => tested.at(-1)?.filter).toEqual(leaf);
});

test('Depth disables further grouping and node limits block saving without losing editability', async ({ page }) => {
  await page.route('**/admin/mail_webhook/settings', route => route.fulfill({ json: settings }));
  await openAdminWebhook(page);
  const editor = page.getByTestId('filter-editor').first();
  const leaf = { field: 'subject', operator: 'contains', value: 'DOWN' };
  let deep: any = leaf;
  for (let i = 0; i < 7; i++) deep = { operator: 'not', children: [deep] };
  await editor.getByText('JSON', { exact: true }).click();
  await editor.getByRole('textbox', { name: 'JSON', exact: true }).fill(JSON.stringify(deep));
  await editor.getByText('可视化', { exact: true }).click();
  await editor.locator('[aria-label="规则类型"]').last().click();
  await expect(page.locator('.n-base-select-option:visible')).toHaveCount(4);
  await expect(page.locator('.n-base-select-option:visible.n-base-select-option--disabled')).toHaveCount(3);
  await page.keyboard.press('Escape');
  const tree = (count: number): any => count === 1 ? leaf : { operator: 'and', children: [
    tree(Math.floor(count / 2)), tree(Math.ceil(count / 2)),
  ] };
  await editor.getByText('JSON', { exact: true }).click();
  const json = editor.getByRole('textbox', { name: 'JSON', exact: true });
  await json.fill(JSON.stringify(tree(50)));
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await json.fill(JSON.stringify(tree(51)));
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await json.fill(JSON.stringify(deep));
  await editor.getByText('可视化', { exact: true }).click();
  await expect(editor.getByRole('button', { name: '移除', exact: true }).first()).toBeVisible();
});

for (const [locale, labels] of Object.entries(adminLabels)) {
  test(`Filter translations and mobile layout: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/admin/mail_webhook/settings', route => route.fulfill({ json: settings }));
    await openAdminWebhook(page, locale);
    const editor = page.getByTestId('filter-editor').first();
    await editor.locator('.group-select').click();
    await page.locator('.n-base-select-option:visible').getByText(labels.condition, { exact: true }).click();
    await expect(editor.locator('.condition-inputs')).toBeVisible();
    expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });
}
