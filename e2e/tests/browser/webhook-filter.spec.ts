import { expect, test } from '@playwright/test';
import { FRONTEND_URL } from '../../fixtures/test-helpers';

const settings = { enabled: true, url: 'https://example.invalid/webhook', method: 'POST', headers: '{}', body: '{}' };
const expression = { operator: 'and', children: [
  { field: 'subject', operator: 'regex', value: '^DOWN', options: { flags: 'i' } },
  { operator: 'not', children: [{ field: 'text', operator: 'contains', value: 'maintenance' }] },
] };

for (const [operator, label] of [['equals', '等于'], ['contains', '包含'], ['startsWith', '开头匹配'], ['endsWith', '结尾匹配']]) {
  test(`Case-sensitive operator selection round-trips JSON: ${operator}`, async ({ page }) => {
    const original = { field: 'subject', operator: `${operator}CaseSensitive`, value: 'DOWN' };
    const saved: any[] = [];
    await page.route('**/admin/mail_webhook/settings', route => {
      if (route.request().method() === 'POST') saved.push(route.request().postDataJSON());
      return route.fulfill({ json: route.request().method() === 'POST' ? { success: true } : { ...settings, filter: original } });
    });
    await page.goto(`${FRONTEND_URL}/zh/admin`);
    await page.getByText('邮件', { exact: true }).click();
    await page.getByText('邮件 Webhook', { exact: true }).click();
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

test('Reusable filter editor nests conditions, round-trips JSON and reports skipped tests', async ({ page }) => {
  const saved: any[] = [];
  const tested: any[] = [];
  await page.route('**/admin/mail_webhook/settings', route => {
    if (route.request().method() === 'POST') saved.push(route.request().postDataJSON());
    return route.fulfill({ json: route.request().method() === 'POST' ? { success: true } : settings });
  });
  await page.route('**/admin/mail_webhook/test', route => {
    tested.push(route.request().postDataJSON());
    return route.fulfill({ json: { success: true, matched: false, skipped: true } });
  });
  await page.goto(`${FRONTEND_URL}/zh/admin`);
  await page.getByText('邮件', { exact: true }).click();
  await page.getByText('邮件 Webhook', { exact: true }).click();
  const editor = page.getByTestId('filter-editor').first();
  await editor.getByRole('button', { name: '添加条件', exact: true }).click();
  await editor.getByPlaceholder('匹配值', { exact: true }).fill('@example.com');
  await editor.getByRole('button', { name: '包入条件组', exact: true }).click();
  await page.getByText('与：全部满足', { exact: true }).click();
  await editor.getByRole('button', { name: '添加条件', exact: true }).click();
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
  const openTest = page.locator('#app').getByRole('button', { name: '测试', exact: true });
  await openTest.click();
  await page.getByRole('dialog').getByRole('button', { name: '仅检查规则', exact: true }).click();
  await expect(page.getByText('条件不匹配，未发送 Webhook', { exact: true })).toBeVisible();
  expect(tested.at(-1)).toMatchObject({ filter: expression, check_only: true });
  await openTest.click();
  await page.getByRole('dialog').getByRole('button', { name: '测试', exact: true }).click();
  expect(tested.at(-1)).not.toHaveProperty('check_only');
  await editor.getByRole('button', { name: '移除', exact: true }).first().click();
  await save.click();
  expect(saved.at(-1).filter).toBeNull();
});

test('Invalid JSON draft does not prevent disabling the webhook', async ({ page }) => {
  const saved: any[] = [];
  await page.route('**/admin/mail_webhook/settings', route => {
    if (route.request().method() === 'POST') saved.push(route.request().postDataJSON());
    return route.fulfill({ json: route.request().method() === 'POST' ? { success: true } : { ...settings, filter: expression } });
  });
  await page.goto(`${FRONTEND_URL}/zh/admin`);
  await page.getByText('邮件', { exact: true }).click();
  await page.getByText('邮件 Webhook', { exact: true }).click();
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

test('Visual edits cannot exceed depth or node limits and remain editable', async ({ page }) => {
  await page.route('**/admin/mail_webhook/settings', route => route.fulfill({ json: settings }));
  await page.goto(`${FRONTEND_URL}/zh/admin`);
  await page.getByText('邮件', { exact: true }).click();
  await page.getByText('邮件 Webhook', { exact: true }).click();
  const editor = page.getByTestId('filter-editor').first();
  const leaf = { field: 'subject', operator: 'contains', value: 'DOWN' };
  let deep: any = leaf;
  for (let i = 0; i < 7; i++) deep = { operator: 'not', children: [deep] };
  for (const value of [deep, { operator: 'and', children: Array.from({ length: 99 }, () => leaf) }]) {
    await editor.getByText('JSON', { exact: true }).click();
    await editor.getByRole('textbox', { name: 'JSON', exact: true }).fill(JSON.stringify(value));
    await editor.getByText('可视化', { exact: true }).click();
    await editor.getByRole('button', { name: '包入条件组', exact: true }).first().click();
    await page.locator('.n-dropdown-option').getByText('与：全部满足', { exact: true }).click();
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await expect(editor.getByRole('button', { name: '移除', exact: true }).first()).toBeVisible();
    await editor.getByText('JSON', { exact: true }).click();
    expect(JSON.parse(await editor.getByRole('textbox', { name: 'JSON', exact: true }).inputValue())).toEqual(value);
    await editor.getByText('可视化', { exact: true }).click();
  }
});

for (const [locale, mails, webhook, label] of [
  ['zh', '邮件', '邮件 Webhook', '添加条件'], ['en', 'Emails', 'Mail Webhook', 'Add condition'],
  ['es', 'Correos', 'Webhook de correo', 'Añadir condición'], ['pt-BR', 'E-mails', 'Webhook de e-mail', 'Adicionar condição'],
  ['ja', 'メール', 'メールWebhook', '条件を追加'], ['de', 'E-Mails', 'Mail-Webhook', 'Bedingung hinzufügen'],
]) {
  test(`Filter translations and mobile layout: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/admin/mail_webhook/settings', route => route.fulfill({ json: settings }));
    await page.goto(`${FRONTEND_URL}/${locale}/admin`);
    await page.getByText(mails, { exact: true }).click();
    await page.getByText(webhook, { exact: true }).click();
    const editor = page.getByTestId('filter-editor').first();
    await editor.getByRole('button', { name: label, exact: true }).click();
    await expect(editor.locator('.condition-inputs')).toBeVisible();
    expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });
}
