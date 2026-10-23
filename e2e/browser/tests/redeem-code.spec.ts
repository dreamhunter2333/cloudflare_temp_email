import { createHash } from 'crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  createTestAddress,
  deleteAddress,
  FRONTEND_URL,
  FRONTEND_URL_ENV_OFF,
  WORKER_URL,
} from '../../fixtures/test-helpers';

const ADMIN_HEADERS = { 'x-admin-auth': 'e2e-admin-pass' };

const uniqueValue = (label: string) => (
  `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

async function createCode(
  request: APIRequestContext,
  type: 'role' | 'send_balance' | 'address_prefix_once',
  value: string,
) {
  const response = await request.post(`${WORKER_URL}/admin/redeem_codes/batch`, {
    headers: ADMIN_HEADERS,
    data: {
      count: 1,
      redeem_type: type,
      value,
      enabled: true,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.codes).toHaveLength(1);
  return body.codes[0] as string;
}

async function findCode(request: APIRequestContext, type: string, code: string) {
  const response = await request.get(
    `${WORKER_URL}/admin/redeem_codes?redeem_type=${type}`
    + `&limit=20&offset=0&query=${encodeURIComponent(code)}`,
    { headers: ADMIN_HEADERS },
  );
  const body = await response.json();
  return body.results.find((row: { code: string }) => row.code === code);
}

async function deleteCode(request: APIRequestContext, type: string, code: string) {
  const row = await findCode(request, type, code);
  if (!row) return;
  await request.delete(`${WORKER_URL}/admin/redeem_codes/${row.id}`, {
    headers: ADMIN_HEADERS,
  });
}

async function createUser(request: APIRequestContext) {
  const email = `${uniqueValue('browser-redeem-user')}@test.example.com`;
  const password = createHash('sha256').update('browser-redeem-password').digest('hex');
  const response = await request.post(`${WORKER_URL}/admin/users`, {
    headers: ADMIN_HEADERS,
    data: { email, password },
  });
  expect(response.ok()).toBe(true);
  const usersResponse = await request.get(
    `${WORKER_URL}/admin/users?limit=10&offset=0&query=${encodeURIComponent(email)}`,
    { headers: ADMIN_HEADERS },
  );
  const user = (await usersResponse.json()).results[0];
  await request.post(`${WORKER_URL}/admin/user_roles`, {
    headers: ADMIN_HEADERS,
    data: { user_id: user.id, role_text: null },
  });
  const loginResponse = await request.post(`${WORKER_URL}/user_api/login`, {
    data: { email, password },
  });
  expect(loginResponse.ok()).toBe(true);
  return { id: user.id as number, email, jwt: (await loginResponse.json()).jwt as string };
}

async function deleteUser(request: APIRequestContext, userId: number) {
  await request.post(`${WORKER_URL}/admin/user_roles`, {
    headers: ADMIN_HEADERS,
    data: { user_id: userId, role_text: null },
  });
  await request.delete(`${WORKER_URL}/admin/users/${userId}`, { headers: ADMIN_HEADERS });
}

test('the mailbox entry opens the pure redemption page and completes role redemption', async ({ page, request }) => {
  const user = await createUser(request);
  const code = await createCode(request, 'role', 'case-role');
  try {
    await page.goto(`${FRONTEND_URL}/en/`);
    await expect(page.getByTestId('redeem-entry')).toBeVisible();
    await page.getByTestId('redeem-entry').click();
    await expect(page).toHaveURL(/\/en\/redeem$/);
    await expect(page.getByTestId('redeem-code-link')).toHaveAttribute(
      'href', 'https://example.com/redeem-codes',
    );
    await page.evaluate((jwt) => localStorage.setItem('userJwt', jwt), user.jwt);
    const settingsResponse = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/user_api/settings'
    ));
    await page.reload();
    await settingsResponse;

    await page.getByTestId('redeem-code-input').locator('input').fill(code);
    await page.getByRole('button', { name: 'Look up code' }).click();
    await expect(page.getByRole('heading', { name: 'Role benefits' })).toBeVisible();
    await expect(page.getByTestId('redeem-user-email')).toHaveCount(0);
    await page.getByTestId('redeem-now').click();
    const userEmailInput = page.getByTestId('redeem-user-email').locator('input');
    await expect(userEmailInput).toHaveValue(user.email);
    await userEmailInput.fill(user.email.toUpperCase());
    const refreshedSettings = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/user_api/settings' && response.ok()
    ));
    await page.getByRole('button', { name: 'Confirm redemption' }).click();
    const refreshedUser = await (await refreshedSettings).json();
    expect(refreshedUser.user_role.role).toBe('case-role');
    expect(refreshedUser.access_token).toEqual(expect.any(String));
    await expect(page.getByRole('heading', { name: 'Redemption complete' })).toBeVisible();
    await expect(page.getByText(user.email, { exact: false })).toBeVisible();
    await expect(page.getByText('case-role', { exact: false })).toBeVisible();

    const row = await findCode(request, 'role', code);
    expect(JSON.parse(row.result)).toMatchObject({ user_email: user.email, role: 'case-role' });
    await page.getByRole('button', { name: 'Redeem another code' }).click();
    await page.getByTestId('redeem-code-input').locator('input').fill(code);
    const nextQuery = page.waitForRequest((request) => (
      new URL(request.url()).pathname === '/redeem_api/query'
    ));
    await page.getByRole('button', { name: 'Look up code' }).click();
    expect((await nextQuery).headers()['x-user-access-token']).toBe(refreshedUser.access_token);
  } finally {
    await deleteCode(request, 'role', code);
    await deleteUser(request, user.id);
  }
});

test('sending credits defaults to the current mailbox and keeps the target editable', async ({ page, request }) => {
  const address = await createTestAddress(request, 'rdb-');
  const code = await createCode(request, 'send_balance', '3');
  try {
    await page.goto(`${FRONTEND_URL}/en/`);
    await expect(page.getByTestId('redeem-entry')).toBeVisible();
    await page.getByTestId('redeem-entry').click();
    await expect(page).toHaveURL(/\/en\/redeem$/);
    await page.evaluate((jwt) => localStorage.setItem('jwt', jwt), address.jwt);
    const settingsResponse = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/settings'
    ));
    await page.reload();
    await settingsResponse;

    await page.getByTestId('redeem-code-input').locator('input').fill(code);
    await page.getByRole('button', { name: 'Look up code' }).click();
    await page.getByTestId('redeem-now').click();
    const targetInput = page.getByTestId('redeem-target-address').locator('input');
    await expect(targetInput).toHaveValue(address.address);
    await targetInput.fill(address.address.toUpperCase());
    await page.getByRole('button', { name: 'Confirm redemption' }).click();
    await expect(page.getByRole('heading', { name: 'Redemption complete' })).toBeVisible();
  } finally {
    await deleteCode(request, 'send_balance', code);
    await deleteAddress(request, address.jwt);
  }
});

test('the special-address page shows and retrieves the same full credentials', async ({ page, request }) => {
  const code = await createCode(request, 'address_prefix_once', 'ui');
  const name = `m${Math.random().toString(36).slice(2, 8)}`;
  let jwt = '';
  try {
    await page.goto(`${FRONTEND_URL}/en/redeem`);
    await page.getByTestId('redeem-code-input').locator('input').fill(code);
    await page.getByRole('button', { name: 'Look up code' }).click();
    await expect(page.getByRole('heading', { name: 'Custom mailbox' })).toBeVisible();
    await expect(page.getByText('Unused', { exact: true })).toBeVisible();
    await page.getByTestId('redeem-address-name').locator('input').fill(name);
    await page.getByRole('button', { name: 'Redeem mailbox' }).click();

    const addressValue = page.getByTestId('address-credential-address');
    const passwordValue = page.getByTestId('address-credential-password');
    const jwtValue = page.getByTestId('address-credential-jwt');
    await expect(addressValue).toHaveText(`ui${name}@test.example.com`);
    const firstAddress = await addressValue.innerText();
    const firstPassword = await passwordValue.innerText();
    const firstJwt = await jwtValue.innerText();
    expect(firstPassword).not.toBe('');
    expect(firstJwt).not.toBe('');
    jwt = firstJwt;

    await page.getByRole('button', { name: 'Redeem another code' }).click();
    await page.getByTestId('redeem-code-input').locator('input').fill(code);
    await page.getByRole('button', { name: 'Look up code' }).click();
    await expect(page.getByText('Used', { exact: true })).toBeVisible();
    await expect(page.getByText(firstAddress, { exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: 'View redemption result' }).click();
    await expect(page.getByTestId('address-credential-address')).toHaveText(firstAddress);
    await expect(page.getByTestId('address-credential-password')).toHaveText(firstPassword);
    await expect(page.getByTestId('address-credential-jwt')).toHaveText(firstJwt);
  } finally {
    if (jwt) {
      await request.delete(`${WORKER_URL}/api/delete_address`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
    }
    await deleteCode(request, 'address_prefix_once', code);
  }
});

test('Admin can batch-create, search, export, and display a redemption result', async ({ page, request }) => {
  let code = '';
  const user = await createUser(request);
  try {
    await page.addInitScript(() => {
      localStorage.setItem('adminAuth', 'e2e-admin-pass');
      sessionStorage.setItem('adminTab', 'redeemCodes');
    });
    await page.goto(`${FRONTEND_URL}/en/admin`);
    await expect(page.getByTestId('redeem-admin-create')).toBeVisible();
    await page.getByTestId('redeem-admin-create').click();

    const dialog = page.getByRole('dialog');
    await dialog.getByTestId('redeem-admin-count').locator('input').fill('1');
    await dialog.getByTestId('redeem-admin-role').click();
    await page.locator('.n-base-select-option').filter({ hasText: 'case-role' }).click();
    await dialog.getByRole('button', { name: 'Generate' }).click();
    await expect(page.getByText('Select a future expiration time')).toBeVisible();
    const expirationInput = dialog.locator('.n-date-picker input');
    await expirationInput.fill('2099-01-01 00:00:00');
    await expirationInput.press('Enter');
    const createResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/admin/redeem_codes/batch'
    ));
    const createdCodesDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Generate' }).click();
    const createResponse = await createResponsePromise;
    code = (await createResponse.json()).codes[0];
    expect((await createdCodesDownload).suggestedFilename()).toBe('redeem-codes-role.csv');
    await expect(page.getByText('Redemption codes generated: 1.')).toBeVisible();

    await page.getByTestId('redeem-admin-search').locator('input').fill(code);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(code, { exact: true })).toBeVisible();

    const exportDownload = page.waitForEvent('download');
    await page.getByTestId('redeem-admin-export').click();
    await expect(page.getByText('Export rows (maximum 10000)')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Download CSV' }).click();
    expect((await exportDownload).suggestedFilename()).toBe('redeem-codes-role.csv');

    const redeemResponse = await request.post(`${WORKER_URL}/redeem_api/redeem`, {
      data: { code, user_email: user.email },
    });
    expect(redeemResponse.ok()).toBe(true);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  } finally {
    if (code) await deleteCode(request, 'role', code);
    await deleteUser(request, user.id);
  }
});

test('Admin ignores a stale list response after switching redemption type', async ({ page }) => {
  let releaseRole!: () => void;
  let markRoleRequested!: () => void;
  let markRoleCompleted!: () => void;
  const roleGate = new Promise<void>((resolve) => { releaseRole = resolve; });
  const roleRequested = new Promise<void>((resolve) => { markRoleRequested = resolve; });
  const roleCompleted = new Promise<void>((resolve) => { markRoleCompleted = resolve; });

  await page.route('**/admin/redeem_codes?*', async (route) => {
    const type = new URL(route.request().url()).searchParams.get('redeem_type');
    if (type === 'role') {
      markRoleRequested();
      await roleGate;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          results: [{
            id: 1,
            code: 'STALE-ROLE-CODE',
            redeem_type: 'role',
            value: 'case-role',
            result: null,
            enabled: 1,
            expires_at: '2099-01-01 00:00:00',
            redeemed_at: null,
          }],
        }),
      });
      markRoleCompleted();
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        results: [{
          id: 2,
          code: 'CURRENT-BALANCE-CODE',
          redeem_type: 'send_balance',
          value: '20',
          result: null,
          enabled: 1,
          expires_at: '2099-01-01 00:00:00',
          redeemed_at: null,
        }],
      }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('adminAuth', 'e2e-admin-pass');
    sessionStorage.setItem('adminTab', 'redeemCodes');
  });
  await page.goto(`${FRONTEND_URL}/en/admin`);
  await roleRequested;

  await page.getByTestId('redeem-admin-filter-type').click();
  await page.locator('.n-base-select-option').filter({ hasText: 'Sending credits' }).click();
  await expect(page.getByText('CURRENT-BALANCE-CODE', { exact: true })).toBeVisible();

  releaseRole();
  await roleCompleted;
  await expect(page.getByText('CURRENT-BALANCE-CODE', { exact: true })).toBeVisible();
  await expect(page.getByText('STALE-ROLE-CODE', { exact: true })).toHaveCount(0);
});

for (const { locale, roleRequired, roleType, addressType, create, generate, prefixError } of [
  {
    locale: 'en', roleRequired: 'Select a role', roleType: 'Role benefits',
    addressType: 'Custom mailbox', create: 'Batch Generate', generate: 'Generate',
    prefixError: 'Use only letters and digits, up to 29 characters. Leave empty for no prefix.',
  },
  {
    locale: 'zh', roleRequired: '请选择角色', roleType: '角色权益',
    addressType: '专属邮箱', create: '批量生成', generate: '生成',
    prefixError: '前缀仅支持英文字母和数字，最多 29 个字符；留空表示无前缀。',
  },
]) {
  test(`Admin validates missing role and invalid prefix in ${locale}`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('adminAuth', 'e2e-admin-pass');
      sessionStorage.setItem('adminTab', 'redeemCodes');
    });
    let createRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST'
        && new URL(request.url()).pathname === '/admin/redeem_codes/batch') {
        createRequests++;
      }
    });
    await page.goto(`${FRONTEND_URL}/${locale}/admin`);
    await expect(page.getByTestId('redeem-admin-filter-type')).toContainText(roleType);
    await page.getByRole('button', { name: create, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: generate, exact: true }).click();
    await expect(page.getByText(roleRequired, { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'close', exact: true }).click();
    await page.getByTestId('redeem-admin-filter-type').click();
    await page.locator('.n-base-select-option').filter({ hasText: addressType }).click();
    await page.getByRole('button', { name: create, exact: true }).click();
    await dialog.locator('input[maxlength]').fill('bad-');
    await dialog.getByRole('button', { name: generate, exact: true }).click();
    await expect(page.getByText(prefixError, { exact: true })).toBeVisible();
    expect(createRequests).toBe(0);
  });
}

test('the disabled frontend hides the entry and redirects the page', async ({ page }) => {
  await page.goto(`${FRONTEND_URL_ENV_OFF}/en/`);
  await expect(page.getByTestId('redeem-entry')).toHaveCount(0);

  await page.goto(`${FRONTEND_URL_ENV_OFF}/en/redeem`);
  await expect(page).not.toHaveURL(/\/redeem$/);
  await expect(page.getByTestId('redeem-entry')).toHaveCount(0);

  await page.addInitScript(() => {
    localStorage.setItem('adminAuth', 'e2e-admin-pass');
  });
  await page.goto(`${FRONTEND_URL_ENV_OFF}/en/admin`);
  await expect(page.getByTestId('redeem-admin-create')).toHaveCount(0);
  await expect(page.getByText('Redemption Codes', { exact: true })).toHaveCount(0);
});
