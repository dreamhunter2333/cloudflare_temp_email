import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { FRONTEND_URL, WORKER_URL } from '../../fixtures/test-helpers';

async function openCreate(page: Page, locale = 'en', domains = ['test.example.com', 'other.example.com']) {
  await page.addInitScript(() => {
    localStorage.setItem('adminAuth', 'e2e-admin-pass');
    sessionStorage.setItem('adminTab', 'account');
  });
  await page.route('**/open_api/settings', async route => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), domains, prefix: 'tmp', randomSubdomainDomains: domains } });
  });
  await page.goto(`${FRONTEND_URL}/${locale}/admin`);
  await page.locator('.n-tabs-tab').getByText(locale === 'en' ? 'Create Email Address' : '创建邮箱', { exact: true }).click();
  await expect(page.getByRole('radio', { name: locale === 'en' ? 'Single creation' : '单个创建', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: locale === 'en' ? 'Batch count' : '批量数量' })).toBeHidden();
  await page.locator('.n-radio').getByText(locale === 'en' ? 'Batch creation' : '批量创建', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: locale === 'en' ? 'Batch count' : '批量数量' })).toBeVisible();
}

const countInput = (page: Page) => page.getByRole('textbox', { name: 'Batch count' });
const createBatch = (page: Page) => page.getByRole('button', { name: /Create batch$/ });
const form = (page: Page) => page.locator('.n-card').filter({
  has: page.getByRole('radio', { name: /^(Single creation|单个创建)$/ }),
});
const row = (index: number) => ({ address: `server${index}@random.test.example.com`, jwt: `jwt${index}+/?=&%#`, address_id: index });

const labels = {
  en: { open: 'Export CSV', download: 'Download CSV', close: 'Close', spreadsheet: /^Spreadsheet-safe CSV/, raw: /^Lossless CSV/ },
  zh: { open: '导出 CSV', download: '下载 CSV', close: '关闭', spreadsheet: /^电子表格安全 CSV/, raw: /^无损 CSV/ },
};

// Downloads through the export dialog and parses the file with csv-parse, independent of the app's escaping.
async function exportCsv(page: Page, { mode = 'spreadsheet', locale = 'en' }: { mode?: 'spreadsheet' | 'raw'; locale?: 'en' | 'zh' } = {}) {
  const text = labels[locale];
  await page.getByRole('button', { name: text.open, exact: true }).click();
  const modal = page.locator('.n-modal');
  await expect(modal).toBeVisible();
  await modal.getByText(text[mode]).click();
  const downloading = page.waitForEvent('download');
  await modal.getByRole('button', { name: text.download, exact: true }).click();
  const download = await downloading;
  const records: string[][] = parse(await readFile((await download.path())!, 'utf8'));
  await modal.getByRole('button', { name: text.close, exact: true }).click();
  await expect(modal).toBeHidden();
  return { filename: download.suggestedFilename(), records };
}

// Reads each login_url back through URL parsing so the JWT check does not reuse the app's encoding.
function decodeRows(records: string[][]) {
  expect(records[0]).toEqual(['address', 'login_url']);
  return records.slice(1).map(([address, link]) => {
    const url = new URL(link);
    expect(`${url.origin}${url.pathname}`).toBe(`${new URL(FRONTEND_URL).origin}/`);
    expect([...url.searchParams.keys()]).toEqual(['jwt']);
    expect(url.hash).toBe('');
    return { address, jwt: url.searchParams.get('jwt') };
  });
}

const pick = (rows: { address: string; jwt: string }[]) => rows.map(({ address, jwt }) => ({ address, jwt }));

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

test('admin exports a batch of mailbox login links', async ({ page, request, browser }) => {
  const created: { address: string; jwt: string; address_id: number }[] = [];
  await page.route('**/admin/new_address', async (route) => {
    const response = await route.fetch();
    if (response.ok()) created.push(await response.json());
    await route.fulfill({ response });
  });

  try {
    await openCreate(page);
    await page.getByRole('textbox', { name: 'Batch count' }).fill('3');
    await page.getByRole('button', { name: 'Create batch', exact: true }).click();
    await expect(page.getByText('Completed: 3 / 3', { exact: true })).toBeVisible();
    const { records } = await exportCsv(page, { mode: 'raw' });
    expect(created).toHaveLength(3);
    expect(decodeRows(records)).toEqual(pick(created));
    const origin = new URL(FRONTEND_URL).origin;

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const mailbox = await context.newPage();
      const settings = mailbox.waitForResponse((res) => new URL(res.url()).pathname === '/api/settings');
      await mailbox.goto(`${origin}/?jwt=${encodeURIComponent(created[0].jwt)}`);
      expect((await (await settings).json()).address).toBe(created[0].address);
    } finally {
      await context.close();
    }
  } finally {
    const failures: string[] = [];
    for (const row of created) {
      try {
        const response = await request.delete(`${WORKER_URL}/admin/delete_address/${row.address_id}`, {
          headers: { 'x-admin-auth': 'e2e-admin-pass' },
        });
        if (!response.ok()) failures.push(`${row.address_id}: HTTP ${response.status()} ${await response.text()}`);
      } catch (error) {
        failures.push(`${row.address_id}: ${String(error)}`);
      }
    }
    expect(failures, 'Failed mailbox cleanup (address_id: error)').toEqual([]);
  }
});

test('rejects invalid counts and accepts both boundaries', async ({ page }) => {
  let calls = 0;
  await page.route('**/admin/new_address', route => route.fulfill({ json: row(++calls) }));
  await openCreate(page);
  for (const value of ['0', '-1', '1.5', '', '101']) {
    await countInput(page).fill(value);
    await countInput(page).blur();
    await expect(createBatch(page)).toBeDisabled();
  }
  expect(calls).toBe(0);
  for (const value of [1, 100]) {
    await countInput(page).fill(String(value));
    await createBatch(page).click();
    await expect(page.getByText(`Completed: ${value} / ${value}`, { exact: true })).toBeVisible();
  }
  expect(calls).toBe(101);
});

test('requires a domain', async ({ page }) => {
  let calls = 0;
  await page.route('**/admin/new_address', route => { calls++; return route.fulfill({ json: row(calls) }); });
  await openCreate(page, 'en', []);
  await expect(createBatch(page)).toBeDisabled();
  await page.locator('.n-radio').getByText('Single creation', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create Email Address', exact: true })).toBeDisabled();
  expect(calls).toBe(0);
});

test('creation mode arrow keys stay within the mode group', async ({ page }) => {
  await openCreate(page);
  const single = page.getByRole('radio', { name: 'Single creation', exact: true });
  const batch = page.getByRole('radio', { name: 'Batch creation', exact: true });
  await single.press('ArrowRight');
  await expect(batch).toBeFocused();
  await expect(batch).toBeChecked();
  await batch.press('ArrowRight');
  await expect(single).toBeFocused();
  await expect(single).toBeChecked();
  await single.press('ArrowLeft');
  await expect(batch).toBeFocused();
  await expect(batch).toBeChecked();
  await expect(form(page).getByRole('radio', { name: 'Normal Domain', exact: true })).toBeChecked();
  await expect(form(page).getByRole('radio', { name: 'Use Random Subdomain', exact: true })).not.toBeChecked();
  await expect(form(page).getByRole('radio', { name: 'Use Custom Subdomain', exact: true })).not.toBeChecked();
});

test('export format arrow keys do not change creation or subdomain modes', async ({ page }) => {
  let calls = 0;
  await page.route('**/admin/new_address', route => route.fulfill({ json: row(++calls) }));
  await openCreate(page);
  await form(page).getByText('Use Random Subdomain', { exact: true }).click();
  await countInput(page).fill('1');
  await createBatch(page).click();
  await expect(page.getByText('Saved results: 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const modal = page.locator('.n-modal');
  const spreadsheet = modal.getByRole('radio', { name: labels.en.spreadsheet });
  const raw = modal.getByRole('radio', { name: labels.en.raw });
  await spreadsheet.press('ArrowRight');
  await expect(raw).toBeFocused();
  await expect(raw).toBeChecked();
  await raw.press('ArrowRight');
  await expect(spreadsheet).toBeFocused();
  await expect(spreadsheet).toBeChecked();
  await spreadsheet.press('ArrowLeft');
  await expect(raw).toBeFocused();
  await expect(raw).toBeChecked();
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Batch creation', exact: true })).toBeChecked();
  await expect(form(page).getByRole('radio', { name: 'Use Random Subdomain', exact: true })).toBeChecked();
  expect(calls).toBe(1);
});

test('switching modes retains shared settings, the single name and batch results', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/admin/new_address', route => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: row(bodies.length) });
  });
  await openCreate(page);
  await page.locator('.n-radio').getByText('Single creation', { exact: true }).click();
  await form(page).locator('.n-input-group .n-input input').first().fill('singlemailbox');
  await form(page).getByRole('switch').click();
  await form(page).getByText('Use Custom Subdomain', { exact: true }).click();
  await form(page).locator('.n-input-group .n-input input').last().fill('team');
  await expect(createBatch(page)).toBeHidden();
  await page.locator('.n-radio').getByText('Batch creation', { exact: true }).click();
  await expect(form(page).getByRole('button', { name: 'Generate Fake Name' })).toHaveCount(0);
  await expect(form(page).getByRole('button', { name: 'Create Email Address', exact: true })).toHaveCount(0);
  await countInput(page).fill('1');
  await createBatch(page).click();
  await expect(page.getByText('Saved results: 1', { exact: true })).toBeVisible();
  await page.locator('.n-radio').getByText('Single creation', { exact: true }).click();
  await expect(form(page).locator('.n-input-group .n-input input').first()).toHaveValue('singlemailbox');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeHidden();
  await form(page).getByRole('button', { name: 'Create Email Address', exact: true }).click();
  await expect(page.locator('.n-modal')).toBeVisible();
  await page.locator('.n-modal').getByRole('button', { name: 'close', exact: true }).click();
  await page.locator('.n-radio').getByText('Batch creation', { exact: true }).click();
  await expect(countInput(page)).toHaveValue('1');
  await expect(page.getByText('Saved results: 1', { exact: true })).toBeVisible();
  expect(bodies).toEqual([
    { enablePrefix: false, enableRandomSubdomain: false, domain: 'team.test.example.com', name: expect.stringMatching(/^[a-z0-9]{1,30}$/) },
    { enablePrefix: false, enableRandomSubdomain: false, domain: 'team.test.example.com', name: 'singlemailbox' },
  ]);
  const { records } = await exportCsv(page, { mode: 'raw' });
  expect(decodeRows(records)).toEqual(pick([row(1)]));
});

test('sends selected domain, prefix and subdomain settings and retains CSV results', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  const rows = [row(1), { ...row(2), address: 'comma,"quote"@random.test.example.com' }, { ...row(3), address: '=1+1@team.other.example.com' }];
  await page.route('**/admin/new_address', route => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: rows[bodies.length - 1] });
  });
  await openCreate(page);
  await countInput(page).fill('1');
  await createBatch(page).click();
  await expect(page.getByText('Saved results: 1', { exact: true })).toBeVisible();
  await form(page).getByRole('switch').click();
  await form(page).locator('.n-select').click();
  await page.getByText('other.example.com', { exact: true }).last().click();
  await form(page).getByText('Use Random Subdomain', { exact: true }).click();
  await createBatch(page).click();
  await expect(page.getByText('Saved results: 2', { exact: true })).toBeVisible();
  await form(page).getByText('Use Custom Subdomain', { exact: true }).click();
  await expect(createBatch(page)).toBeDisabled();
  await form(page).locator('.n-input-group .n-input input').last().fill('   ');
  await expect(createBatch(page)).toBeDisabled();
  expect(bodies).toHaveLength(2);
  await form(page).locator('.n-input-group .n-input input').last().fill('team');
  await createBatch(page).click();
  await expect(page.getByText('Saved results: 3', { exact: true })).toBeVisible();
  expect(bodies).toEqual([
    { enablePrefix: true, enableRandomSubdomain: false, domain: 'test.example.com', name: expect.stringMatching(/^[a-z0-9]{1,30}$/) },
    { enablePrefix: false, enableRandomSubdomain: true, domain: 'other.example.com', name: expect.stringMatching(/^[a-z0-9]{1,30}$/) },
    { enablePrefix: false, enableRandomSubdomain: false, domain: 'team.other.example.com', name: expect.stringMatching(/^[a-z0-9]{1,30}$/) },
  ]);
  expect(new Set(bodies.map(body => body.name)).size).toBe(3);
  const { records } = await exportCsv(page);
  expect(decodeRows(records)).toEqual(pick([rows[0], rows[1], { ...rows[2], address: "'=1+1@team.other.example.com" }]));
  await page.getByRole('button', { name: 'Clear results', exact: true }).click();
  await expect(page.getByText('Saved results: 0', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
});

test('export dialog offers a lossless CSV and a spreadsheet-safe CSV', async ({ page }) => {
  const rows = [
    { address: '+alice@test.example.com', jwt: 'eyJ+a/b=.c?d&e%f#g "h",i' },
    { address: '-bob@test.example.com', jwt: 'jwt-2' },
    { address: '=1+1@test.example.com', jwt: '=jwt3' },
    { address: '@carol@test.example.com', jwt: 'jwt4' },
    { address: 'comma,"quote"@test.example.com', jwt: 'jwt,"5"' },
    { address: 'plain@test.example.com', jwt: 'jwt6' },
  ].map((value, index) => ({ ...value, address_id: index }));
  let calls = 0;
  await page.route('**/admin/new_address', route => route.fulfill({ json: rows[calls++] }));
  await openCreate(page);
  await countInput(page).fill(String(rows.length));
  await createBatch(page).click();
  await expect(page.getByText(`Saved results: ${rows.length}`, { exact: true })).toBeVisible();

  const modal = page.locator('.n-modal');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Export login links');
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(modal).toBeHidden();

  const raw = await exportCsv(page, { mode: 'raw' });
  expect(raw.filename).toBe('mailbox-login-links-raw.csv');
  expect(decodeRows(raw.records)).toEqual(pick(rows));

  const safe = await exportCsv(page, { mode: 'spreadsheet' });
  expect(safe.filename).toBe('mailbox-login-links.csv');
  expect(decodeRows(safe.records)).toEqual(pick([
    { ...rows[0], address: "'+alice@test.example.com" },
    { ...rows[1], address: "'-bob@test.example.com" },
    { ...rows[2], address: "'=1+1@test.example.com" },
    { ...rows[3], address: "'@carol@test.example.com" },
    rows[4],
    rows[5],
  ]));
  expect(calls).toBe(rows.length);
});

test('locks shared settings and mode switching for the entire sequential batch', async ({ page }) => {
  const gates = [gate(), gate()];
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  await page.route('**/admin/new_address', async route => {
    const index = calls++;
    maxActive = Math.max(maxActive, ++active);
    await gates[index].promise;
    await route.fulfill({ json: row(index) });
    active--;
  });
  await openCreate(page);
  await countInput(page).fill('2');
  await form(page).getByText('Use Custom Subdomain', { exact: true }).click();
  await form(page).locator('.n-input-group .n-input input').last().fill('team');
  try {
    await createBatch(page).click();
    for (let i = 0; i < 2; i++) {
      await expect.poll(() => calls).toBe(i + 1);
      await expect(createBatch(page)).toBeDisabled();
      await expect(form(page).getByRole('button', { name: 'Create Email Address', exact: true })).toHaveCount(0);
      await expect(form(page).getByRole('button', { name: 'Generate Fake Name' })).toHaveCount(0);
      await expect(countInput(page)).toBeDisabled();
      for (const input of await form(page).locator('.n-input-group .n-input input').all()) await expect(input).toBeDisabled();
      await expect(form(page).locator('.n-select .n-base-selection')).toHaveClass(/n-base-selection--disabled/);
      await expect(form(page).getByRole('switch')).toHaveClass(/n-switch--disabled/);
      for (const radio of await form(page).getByRole('radio').all()) await expect(radio).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Clear results' })).toBeDisabled();
      // Dispatch repeated clicks even while disabled to exercise the handler's busy guard.
      await createBatch(page).dispatchEvent('click');
      expect(calls).toBe(i + 1);
      gates[i].release();
    }
    await expect(page.getByText('Completed: 2 / 2', { exact: true })).toBeVisible();
    expect(calls).toBe(2);
    expect(maxActive).toBe(1);
    await expect(createBatch(page)).toBeEnabled();
  } finally {
    gates.forEach(g => g.release());
  }
});

for (const scenario of [
  { locale: 'en', status: 0, successes: 2 },
  { locale: 'zh', status: 429, successes: 2 },
  { locale: 'en', status: 500, successes: 0 },
]) {
  test(`stops after ${scenario.successes} successes on ${scenario.status || 'network failure'} (${scenario.locale})`, async ({ page }) => {
    let calls = 0;
    await page.route('**/admin/new_address', route => {
      const index = calls++;
      if (index < scenario.successes) return route.fulfill({ json: row(index) });
      return scenario.status ? route.fulfill({ status: scenario.status, body: 'batch-test-failure' }) : route.abort('failed');
    });
    await openCreate(page, scenario.locale);
    const chinese = scenario.locale === 'zh';
    await page.getByRole('textbox', { name: chinese ? '批量数量' : 'Batch count' }).fill('5');
    const button = page.getByRole('button', { name: chinese ? '批量创建' : 'Create batch', exact: true });
    await button.click();
    await expect(page.getByText(chinese ? '已完成：2 / 5' : `Completed: ${scenario.successes} / 5`, { exact: true })).toBeVisible();
    await expect(page.getByText(chinese ? /批量创建已停止。中断的请求/ : /Batch stopped\. Interrupted requests/)).toBeVisible();
    if (scenario.status) await expect(page.locator('.n-alert')).toContainText('batch-test-failure');
    await expect(button).toBeEnabled();
    expect(calls).toBe(scenario.successes + 1);
    if (scenario.successes) {
      const { records } = await exportCsv(page, { locale: chinese ? 'zh' : 'en' });
      expect(decodeRows(records)).toEqual(pick(Array.from({ length: scenario.successes }, (_, i) => row(i))));
    } else {
      await expect(page.getByRole('button', { name: chinese ? '导出 CSV' : 'Export CSV' })).toBeDisabled();
    }
    expect(calls).toBe(scenario.successes + 1);
  });
}

test('leaving the create pane stops an outstanding batch', async ({ page }) => {
  const held = gate();
  const finished = gate();
  let calls = 0;
  await page.route('**/admin/new_address', async route => {
    calls++;
    await held.promise;
    await route.fulfill({ json: row(1) });
    finished.release();
  });
  await openCreate(page);
  await countInput(page).fill('3');
  try {
    await createBatch(page).click();
    await expect.poll(() => calls).toBe(1);
    await page.locator('.n-tabs-tab').getByText('Mailboxes', { exact: true }).click();
    await expect(countInput(page)).toHaveCount(0);
    const response = page.waitForResponse('**/admin/new_address');
    held.release();
    await response;
    await finished.promise;
    await page.locator('.n-tabs-tab').getByText('Create Email Address', { exact: true }).click();
    await page.locator('.n-radio').getByText('Batch creation', { exact: true }).click();
    await expect(page.getByText('Saved results: 0', { exact: true })).toBeVisible();
    // Give the abandoned continuation a chance to send another request.
    await page.waitForTimeout(200);
    expect(calls).toBe(1);
  } finally {
    held.release();
  }
});

test('single creation still opens credentials and batch controls fit mobile in Chinese', async ({ page }, testInfo) => {
  const single = { ...row(1), password: 'single-mailbox-password' };
  let body: Record<string, unknown> | undefined;
  await page.route('**/admin/new_address', route => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: single });
  });
  await openCreate(page, 'zh');
  await page.setViewportSize({ width: 390, height: 844 });
  const count = page.getByRole('textbox', { name: '批量数量' });
  const card = form(page);
  for (const control of [count, page.getByRole('button', { name: '批量创建', exact: true }), page.getByRole('button', { name: '导出 CSV' })]) {
    await expect(control).toBeVisible();
    const bounds = (await control.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }
  await testInfo.attach('mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.locator('.n-radio').getByText('单个创建', { exact: true }).click();
  await expect(count).toBeHidden();
  await card.locator('.n-input-group .n-input input').first().fill('singlemailbox');
  await card.getByRole('button', { name: '创建邮箱', exact: true }).click();
  await expect(page.locator('.n-modal')).toBeVisible();
  await expect(page.locator('.n-modal')).toContainText(single.address);
  await expect(page.locator('.n-modal')).toContainText(single.password);
  expect(body).toEqual({ enablePrefix: true, enableRandomSubdomain: false, domain: 'test.example.com', name: 'singlemailbox' });
});
