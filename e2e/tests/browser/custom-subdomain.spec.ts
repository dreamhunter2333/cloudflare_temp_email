import { expect, test } from '@playwright/test';
import { FRONTEND_URL, TEST_DOMAIN, deleteAddress } from '../../fixtures/test-helpers';

test('create an address with a custom subdomain from the UI', async ({ page, request }) => {
  let jwt: string | undefined;

  try {
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.getByRole('button', { name: 'Create Email Address' }).click();

    const name = `subui${Date.now()}`;
    const createForm = page.locator('.n-tab-pane:visible form');
    await createForm.locator('.n-input-group .n-input input').fill(name);

    const domainSelect = createForm.locator('.n-input-group .n-select');
    await expect(domainSelect.locator('input')).toHaveCount(0);

    const normalSubdomain = createForm.getByRole('radio', { name: 'Normal Domain' });
    const randomSubdomain = createForm.getByRole('radio', { name: 'Use Random Subdomain' });
    const customSubdomain = createForm.getByRole('radio', { name: 'Use Custom Subdomain' });

    await expect(normalSubdomain).toBeChecked();
    await createForm.getByText('Use Random Subdomain', { exact: true }).click();
    await expect(normalSubdomain).not.toBeChecked();
    await expect(randomSubdomain).toBeChecked();
    await expect(customSubdomain).not.toBeChecked();

    await createForm.getByText('Use Custom Subdomain', { exact: true }).click();
    await expect(randomSubdomain).not.toBeChecked();
    await expect(customSubdomain).toBeChecked();

    await createForm.getByText('Use Random Subdomain', { exact: true }).click();
    await expect(randomSubdomain).toBeChecked();
    await expect(customSubdomain).not.toBeChecked();

    await createForm.getByText('Use Custom Subdomain', { exact: true }).click();
    await createForm.locator('.n-input-group:visible .n-input input').last().fill('team');

    await createForm.getByRole('button', { name: 'Create Email Address' }).click();

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
