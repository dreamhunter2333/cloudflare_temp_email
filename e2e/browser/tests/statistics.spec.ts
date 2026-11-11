import { expect, test, type Page } from '@playwright/test';
import { FRONTEND_URL } from '../../fixtures/test-helpers';

const domain = 'statistics.example.com';

async function mockStatistics(page: Page, initialFails = false) {
  const userTotals = { userCount: 83, activeUserCount7days: 12, activeUserCount30days: 21 };
  const mailboxTotals = { mailCount: 9, addressCount: 7, sendMailCount: 3, activeAddressCount7days: 2, activeAddressCount30days: 4 };
  const requests: { domain: string | null; skipUsers: string | null; includeTotals: string | null }[] = [];
  let releaseInitialTotals!: () => void;
  const initialTotalsPending = new Promise<void>(resolve => { releaseInitialTotals = resolve; });

  await page.addInitScript(() => {
    localStorage.setItem('adminAuth', 'e2e-admin-pass');
    sessionStorage.setItem('adminTab', 'statistics');
  });
  await page.route('**/open_api/settings', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), domains: [domain], domainLabels: [] } });
  });
  await page.route('**/admin/statistics?*', async route => {
    const params = new URL(route.request().url()).searchParams;
    const headers = { 'access-control-allow-origin': '*' };
    const skipUsers = params.get('skipUsers');
    const includeTotals = params.get('includeTotals');
    requests.push({ domain: params.get('domain'), skipUsers, includeTotals });
    const trends = { mailCount: [], addressCount: [], sendMailCount: [], ...(!skipUsers && { userCount: [] }) };
    if (requests.length === 1) {
      await initialTotalsPending;
      if (initialFails) {
        await route.fulfill({ headers, status: 500, body: 'Initial totals failed' });
        return;
      }
    }
    const totals = includeTotals ? { ...mailboxTotals, ...(!skipUsers && userTotals) } : undefined;
    await route.fulfill({ headers, json: { totals, trends } });
  });
  return { requests, releaseInitialTotals };
}

for (const initialFails of [false, true]) {
  const outcome = initialFails ? 'failure' : 'success';
  test(`domain filtering waits for initial totals and works after ${outcome}`, async ({ page }) => {
    const { requests, releaseInitialTotals } = await mockStatistics(page, initialFails);
    const select = page.locator('.domain-filter .n-base-selection');
    const dashboard = page.locator('.dashboard');

    try {
      await page.goto(`${FRONTEND_URL}/en/admin`);
      await expect.poll(() => requests).toEqual([{ domain: '', skipUsers: null, includeTotals: 'true' }]);
      await expect(select).toHaveClass(/n-base-selection--disabled/);
    } finally {
      releaseInitialTotals();
    }

    await expect(dashboard).toHaveAttribute('aria-busy', 'false');
    await expect(select).not.toHaveClass(/n-base-selection--disabled/);
    await select.click();
    await page.getByText(domain, { exact: true }).click();
    await expect.poll(() => requests).toEqual([
      { domain: '', skipUsers: null, includeTotals: 'true' },
      { domain, skipUsers: initialFails ? null : 'true', includeTotals: 'true' },
    ]);
    await expect(dashboard.locator('.totals').getByText('83', { exact: true })).toBeVisible();
    await expect(dashboard.locator('.totals').getByText('9', { exact: true })).toBeVisible();
    await expect(dashboard.locator('.error')).toHaveCount(0);

    await page.getByRole('button', { name: 'Time range', exact: true }).click();
    await page.getByRole('button', { name: 'Last 30 days', exact: true }).click();
    await expect.poll(() => requests.slice(2)).toEqual([{ domain, skipUsers: null, includeTotals: null }]);
    await expect(dashboard.locator('.totals').getByText('83', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => requests.slice(3)).toEqual([{ domain, skipUsers: null, includeTotals: 'true' }]);
  });
}
