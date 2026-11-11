import { expect, test } from '@playwright/test';
import { FRONTEND_URL } from '../../fixtures/test-helpers';

test('switching domains reuses a pending user totals request', async ({ page }) => {
  const domain = 'statistics.example.com';
  const userTotals = { userCount: 83, activeUserCount7days: 12, activeUserCount30days: 21 };
  const mailboxTotals = { mailCount: 9, addressCount: 7, sendMailCount: 3, activeAddressCount7days: 2, activeAddressCount30days: 4 };
  const requests: { domain: string | null; skipUsers: string | null }[] = [];
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
    if (params.get('view') !== 'totals') {
      const trends = { mailCount: [], addressCount: [], sendMailCount: [] };
      await route.fulfill({ headers, json: skipUsers ? trends : { ...trends, userCount: [] } });
      return;
    }
    requests.push({ domain: params.get('domain'), skipUsers });
    if (!params.get('domain')) {
      await initialTotalsPending;
      await route.fulfill({ headers, json: { ...mailboxTotals, ...userTotals, mailCount: 100 } });
      return;
    }
    await route.fulfill({ headers, json: skipUsers ? mailboxTotals : { ...mailboxTotals, ...userTotals } });
  });

  try {
    await page.goto(`${FRONTEND_URL}/en/admin`);
    await expect.poll(() => requests).toEqual([{ domain: '', skipUsers: null }]);
    await page.locator('.domain-filter .n-base-selection').click();
    await page.getByText(domain, { exact: true }).click();
    await expect.poll(() => requests).toEqual([
      { domain: '', skipUsers: null },
      { domain, skipUsers: 'true' },
    ]);
  } finally {
    releaseInitialTotals();
  }

  await expect(page.locator('.dashboard')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.totals').getByText('83', { exact: true })).toBeVisible();
  await expect(page.locator('.totals').getByText('9', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(() => requests.at(-1)).toEqual({ domain, skipUsers: null });
});
