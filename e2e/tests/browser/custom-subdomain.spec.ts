import { expect, test } from '@playwright/test';
import { FRONTEND_URL, TEST_DOMAIN, deleteAddress } from '../../fixtures/test-helpers';

test('create an address with a custom subdomain from the UI', async ({ page, request }) => {
  let jwt: string | undefined;

  try {
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.getByRole('button', { name: 'Create New Email' }).click();

    const name = `subui${Date.now()}`;
    const createForm = page.locator('.n-tab-pane:visible form');
    await createForm.locator('.n-input-group .n-input input').fill(name);

    const domainSelect = createForm.locator('.n-input-group .n-select');
    await expect(domainSelect.locator('input')).toHaveCount(0);

    const randomSubdomain = createForm.getByRole('checkbox', { name: 'Use Random Subdomain' });
    const customSubdomain = createForm.getByRole('checkbox', { name: 'Use Custom Subdomain' });
    await randomSubdomain.check();
    await customSubdomain.check();
    await expect(randomSubdomain).not.toBeChecked();
    const customSubdomainRow = createForm.locator('.n-form-item-row').filter({ has: customSubdomain });
    await customSubdomainRow.locator('.n-input input').fill('team');

    await createForm.getByRole('button', { name: 'Create New Email' }).click();

    const domain = `team.${TEST_DOMAIN}`;
    const address = `tmp${name}@${domain}`;
    await expect(page.locator('code').getByText(address, { exact: true })).toBeVisible();
    await page.waitForFunction(() => Boolean(localStorage.getItem('jwt')));
    jwt = await page.evaluate(() => localStorage.getItem('jwt') || undefined);
    expect(jwt).toBeTruthy();
  } finally {
    if (jwt) await deleteAddress(request, jwt);
  }
});
