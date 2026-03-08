import { test, expect } from '@playwright/test';
import { request as apiRequest } from '@playwright/test';
import { WORKER_URL, FRONTEND_URL } from '../../fixtures/test-helpers';

const TEST_USER_EMAIL = `passkey-browser-${Date.now()}@test.example.com`;
const TEST_USER_PASSWORD = 'browser-test-pwd-123';

test.describe('Passkey Browser Flow', () => {
  test.beforeAll(async () => {
    const api = await apiRequest.newContext();
    try {
      // Enable user registration
      await api.post(`${WORKER_URL}/admin/user_settings`, {
        data: { enable: true, enableMailVerify: false },
      });
      // Register user
      await api.post(`${WORKER_URL}/user_api/register`, {
        data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
      });
    } finally {
      await api.dispose();
    }
  });

  test('register passkey, then login with passkey', async ({ page, context }) => {
    // Set up virtual authenticator via CDP
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });

    try {
      // === Step 1: Login through UI ===
      await page.goto(`${FRONTEND_URL}/en/user`);

      // Fill login form
      const emailInput = page.getByRole('textbox', { name: 'Please Input' }).first();
      await emailInput.fill(TEST_USER_EMAIL);
      const passwordInput = page.getByRole('textbox', { name: 'Please Input' }).nth(1);
      await passwordInput.fill(TEST_USER_PASSWORD);
      await page.getByRole('button', { name: 'Login' }).first().click();

      // Wait for login to complete — user email should appear
      await expect(page.getByText(TEST_USER_EMAIL)).toBeVisible({ timeout: 10_000 });

      // === Step 2: Click "User Settings" tab ===
      await page.getByText('User Settings').click();

      // === Step 3: Create a passkey ===
      await page.getByRole('button', { name: 'Create Passkey' }).click();

      // Fill passkey name in the modal
      const createModal = page.locator('.n-dialog');
      await expect(createModal).toBeVisible({ timeout: 5_000 });
      await createModal.getByRole('textbox').fill('E2E Test Passkey');

      // Click the Create Passkey button inside the modal
      await createModal.getByRole('button', { name: 'Create Passkey' }).click();

      // Wait for success — modal should close
      await expect(createModal).not.toBeVisible({ timeout: 10_000 });

      // === Step 4: Verify passkey appears in the list ===
      await page.getByRole('button', { name: 'Show Passkey List' }).click();

      const listModal = page.locator('.n-card-header:has-text("Show Passkey List")').locator('..');
      await expect(page.getByText('E2E Test Passkey')).toBeVisible({ timeout: 5_000 });

      // Close the list modal
      await page.keyboard.press('Escape');

      // === Step 5: Logout ===
      await page.getByRole('button', { name: 'Logout' }).click();
      const logoutModal = page.locator('.n-dialog');
      await expect(logoutModal).toBeVisible({ timeout: 5_000 });
      await logoutModal.getByRole('button', { name: 'Logout' }).click();

      // Wait for logout to complete and navigate to user page
      await page.waitForTimeout(2000);
      await page.goto(`${FRONTEND_URL}/en/user`);

      // === Step 6: Login with passkey ===
      const passkeyBtn = page.getByRole('button', { name: 'Login with Passkey' });
      await expect(passkeyBtn).toBeVisible({ timeout: 10_000 });
      await passkeyBtn.click();

      // Virtual authenticator handles the WebAuthn ceremony automatically
      // Wait for login to complete — user email should appear
      await expect(page.getByText(TEST_USER_EMAIL)).toBeVisible({ timeout: 15_000 });
    } finally {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
      await cdp.detach();
    }
  });
});
