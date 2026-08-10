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
    await saveSubdomainMatchSetting(true);
    await page.goto(`${FRONTEND_URL}/en/`);
    await page.getByRole('button', { name: 'Create New Email' }).click();

    const name = `subui${Date.now()}`;
    const domain = `team.${TEST_DOMAIN}`;
    await page.locator('.n-input-group:visible .n-input input').fill(name);

    const domainSelect = page.locator('.n-input-group:visible .n-select');
    await domainSelect.click();
    await domainSelect.locator('input').fill(domain);
    await domainSelect.locator('input').press('Enter');

    await page.getByRole('button', { name: 'Create New Email' }).last().click();

    const address = `TMP${name}@${domain}`;
    await expect(page.locator('code').getByText(address, { exact: true })).toBeVisible();
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
