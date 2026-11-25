import { expect, test, type Page } from '@playwright/test';
import { FRONTEND_URL } from '../../../fixtures/test-helpers';

async function mockStatistics(page: Page, initialFails = false) {
  const userTotals = { userCount: 83, activeUserCount7days: 12, activeUserCount30days: 21 };
  const mailboxTotals = { mailCount: 9, addressCount: 7, sendMailCount: 3, activeAddressCount7days: 2, activeAddressCount30days: 4 };
  const requests: (string | null)[] = [];
  let releaseInitialTotals!: () => void;
  const initialTotalsPending = new Promise<void>(resolve => { releaseInitialTotals = resolve; });

  await page.addInitScript(() => {
    localStorage.setItem('adminAuth', 'e2e-admin-pass');
    sessionStorage.setItem('adminTab', 'statistics');
  });
  await page.route('**/admin/statistics?*', async route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    expect(params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    expect(params.get('granularity')).toBe('day');
    expect(params.has('domain')).toBe(false);
    const headers = { 'access-control-allow-origin': '*' };
    const includeTotals = params.get('includeTotals');
    requests.push(includeTotals);
    const trends = { mailCount: [], addressCount: [], sendMailCount: [], userCount: [] };
    if (requests.length === 1) {
      await initialTotalsPending;
      if (initialFails) {
        await route.fulfill({ headers, status: 500, body: 'Initial totals failed' });
        return;
      }
    }
    const totals = includeTotals ? { ...mailboxTotals, ...userTotals } : undefined;
    await route.fulfill({ headers, json: { totals, trends } });
  });
  return { requests, releaseInitialTotals };
}

for (const initialFails of [false, true]) {
  const outcome = initialFails ? 'failure' : 'success';
  test(`date filtering waits for initial totals and works after ${outcome}`, async ({ page }) => {
    const { requests, releaseInitialTotals } = await mockStatistics(page, initialFails);
    const dashboard = page.locator('.dashboard');
    const timeRange = page.getByRole('button', { name: 'Time range', exact: true });

    try {
      await page.goto(`${FRONTEND_URL}/en/admin`);
      await expect.poll(() => requests).toEqual(['true']);
      await expect(timeRange).toBeDisabled();
    } finally {
      releaseInitialTotals();
    }

    await expect(dashboard).toHaveAttribute('aria-busy', 'false');
    await timeRange.click();
    await page.getByRole('button', { name: 'Last 30 days', exact: true }).click();
    await expect.poll(() => requests).toEqual(['true', initialFails ? 'true' : null]);
    await expect(dashboard.locator('.totals').getByText('83', { exact: true })).toBeVisible();
    await expect(dashboard.locator('.totals').getByText('9', { exact: true })).toBeVisible();
    await expect(dashboard.locator('.error')).toHaveCount(0);

    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => requests.slice(2)).toEqual(['true']);
  });
}
