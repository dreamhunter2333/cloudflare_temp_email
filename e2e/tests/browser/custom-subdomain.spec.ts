import { expect, request as apiRequest, test } from '@playwright/test';
import { FRONTEND_URL, TEST_DOMAIN, WORKER_URL, deleteAddress } from '../../fixtures/test-helpers';

test('create an address with a custom subdomain from the UI', async ({ page }) => {
  const api = await apiRequest.newContext();
  const settingsResponse = await api.get(`${WORKER_URL}/admin/account_settings`);
  expect(settingsResponse.ok()).toBe(true);
  const settings = await settingsResponse.json();
  const originalEnabled = settings.addressCreationSubdomainMatchStatus?.storedEnabled;
  let jwt: string | undefined;

  const saveSubdomainMatchSetting = async (enableSubdomainMatch: boolean | null) => {
    const response = await api.post(`${WORKER_URL}/admin/account_settings`, {
      data: {
        blockList: settings.blockList || [],
        sendBlockList: settings.sendBlockList || [],
        verifiedAddressList: settings.verifiedAddressList || [],
        fromBlockList: settings.fromBlockList || [],
        noLimitSendAddressList: settings.noLimitSendAddressList || [],
        emailRuleSettings: settings.emailRuleSettings || {},
        addressCreationSettings: { enableSubdomainMatch },
      },
    });
    expect(response.ok()).toBe(true);
  };

  try {
    await saveSubdomainMatchSetting(false);
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.getByRole('button', { name: 'Create New Email' }).click();

    const disabledCreateForm = page.locator('.n-tab-pane:visible form');
    const disabledDomainSelect = disabledCreateForm.locator('.n-input-group .n-select');
    await expect(disabledDomainSelect.locator('input')).toHaveCount(0);
    await expect(disabledCreateForm.getByText('Use Random Subdomain', { exact: true })).toBeVisible();
    await expect(disabledCreateForm.getByText('Use Custom Subdomain', { exact: true })).toHaveCount(0);
    await expect(disabledCreateForm.getByText(
      'You can choose a domain from the dropdown list.', { exact: true }
    )).toBeVisible();

    await saveSubdomainMatchSetting(true);
    await page.reload();
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
    await createForm.getByPlaceholder('Custom subdomain').fill('team');

    await createForm.getByRole('button', { name: 'Create New Email' }).click();

    const domain = `team.${TEST_DOMAIN}`;
    const address = `tmp${name}@${domain}`;
    await expect(page.locator('code').getByText(address, { exact: true })).toBeVisible();
    await page.waitForFunction(() => Boolean(localStorage.getItem('jwt')));
    jwt = await page.evaluate(() => localStorage.getItem('jwt') || undefined);
    expect(jwt).toBeTruthy();
  } finally {
    try {
      if (jwt) await deleteAddress(api, jwt);
      await saveSubdomainMatchSetting(typeof originalEnabled === 'boolean' ? originalEnabled : null);
    } finally {
      await api.dispose();
    }
  }
});
