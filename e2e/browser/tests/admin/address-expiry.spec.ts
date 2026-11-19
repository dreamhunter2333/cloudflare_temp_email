import { expect, test, type Page } from '@playwright/test';
import { FRONTEND_URL, FRONTEND_URL_ENV_OFF } from '../../../fixtures/test-helpers';

async function openAdminCreate(page: Page, baseUrl: string) {
  await page.addInitScript(() => {
    localStorage.setItem('adminAuth', 'e2e-admin-pass');
    sessionStorage.setItem('adminTab', 'account');
  });
  await page.goto(`${baseUrl}/en/admin`);
  await page.locator('.n-tabs-tab').getByText('Create Email Address', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Single creation', exact: true })).toBeChecked();
}

const formCard = (page: Page) => page.locator('.n-card').filter({
  has: page.getByRole('radio', { name: 'Single creation', exact: true }),
});

test.describe('Address Expiration UI', () => {
  test('hides expiry controls when ENABLE_ADDRESS_EXPIRY is unset/off', async ({ page }) => {
    test.skip(!FRONTEND_URL_ENV_OFF, 'FRONTEND_URL_ENV_OFF is not configured');
    const adminSettingsPromise = page.waitForResponse((res) =>
      res.url().includes('/open_api/settings') && res.status() === 200
    );
    await openAdminCreate(page, FRONTEND_URL_ENV_OFF);
    expect((await (await adminSettingsPromise).json()).enableAddressExpiry).toBe(false);
    await expect(formCard(page).getByText('Expiration (Optional)', { exact: true })).toHaveCount(0);
    await expect(formCard(page).locator('.n-select')).toHaveCount(1);

    const homeSettingsPromise = page.waitForResponse((res) =>
      res.url().includes('/open_api/settings') && res.status() === 200
    );
    await page.goto(`${FRONTEND_URL_ENV_OFF}/en/`);
    expect((await (await homeSettingsPromise).json()).enableAddressExpiry).toBe(false);
    await page.locator('.n-tabs-tab').getByText('Create Email Address', { exact: true }).click();
    await expect(page.getByText('Expiration (Optional)', { exact: true })).toHaveCount(0);
  });

  test('shows expiry controls and validates custom batch expiry when enabled', async ({ page }) => {
    const bodies: Record<string, unknown>[] = [];
    await page.route('**/admin/new_address', route => {
      bodies.push(route.request().postDataJSON());
      const index = bodies.length;
      return route.fulfill({
        json: {
          address: `exp${index}@test.example.com`,
          jwt: `jwt-${index}`,
          address_id: index,
          expires_at: '2099-01-01 00:00:00',
        },
      });
    });

    await openAdminCreate(page, FRONTEND_URL);
    const card = formCard(page);
    await expect(card.getByText('Expiration (Optional)', { exact: true })).toBeVisible();

    // Switch to batch creation and verify the preset sends an absolute UTC timestamp.
    await page.locator('.n-radio').getByText('Batch creation', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Batch count' }).fill('1');

    const expirySelect = card.locator('.n-form-item', { hasText: 'Expiration (Optional)' }).locator('.n-select');
    await expirySelect.click();
    await page.locator('.n-base-select-option').getByText('24 hours', { exact: true }).click();

    const batchButton = page.getByRole('button', { name: 'Create batch', exact: true });
    const beforeCreate = Date.now();
    await batchButton.click();
    await expect(page.getByText('Completed: 1 / 1', { exact: true })).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].expiresAt).toMatch(/Z$/);
    const presetDeadline = Date.parse(String(bodies[0].expiresAt));
    expect(presetDeadline).toBeGreaterThanOrEqual(beforeCreate + 86_400_000);
    expect(presetDeadline).toBeLessThanOrEqual(Date.now() + 86_400_000);
    expect(bodies[0]).not.toHaveProperty('expiryMode');

    // Custom mode without selected timestamp disables batch creation and sends 0 requests
    await expirySelect.click();
    await page.locator('.n-base-select-option').getByText('Custom date & time (YYYY-MM-DD HH:mm:ss)', { exact: true }).click();
    await expect(batchButton).toBeDisabled();
    expect(bodies).toHaveLength(1);

    // Entering a past timestamp keeps Create batch disabled
    const dateInput = card.locator('.n-date-picker input');
    await dateInput.fill('2020-01-01 00:00:00');
    await dateInput.press('Enter');
    await expect(batchButton).toBeDisabled();
    expect(bodies).toHaveLength(1);

    // Entering a valid future timestamp re-enables batch creation and submits ISO expiresAt
    await dateInput.fill('2099-01-01 00:00:00');
    await dateInput.press('Enter');
    await expect(batchButton).toBeEnabled();
    await batchButton.click();
    await expect(page.getByText('Saved results: 2', { exact: true })).toBeVisible();
    expect(bodies).toHaveLength(2);
    expect(typeof bodies[1].expiresAt).toBe('string');
    expect(Date.parse(String(bodies[1].expiresAt))).toBeGreaterThan(Date.now());
  });
});
