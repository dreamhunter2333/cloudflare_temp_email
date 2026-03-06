import { test, expect } from '@playwright/test';
import {
  FRONTEND_URL,
  createTestAddress,
  seedTestMail,
  deleteAddress,
} from '../../fixtures/test-helpers';
import { request as apiRequest } from '@playwright/test';

test.describe('Inbox Browser Flow', () => {
  test('login via JWT, view inbox, open email', async ({ page }) => {
    // Create API context for setup
    const api = await apiRequest.newContext();
    let jwt: string | undefined;

    try {
      const created = await createTestAddress(api, 'inbox-browser');
      jwt = created.jwt;
      const address = created.address;

      // Seed an email
      const subject = `Browser Test ${Date.now()}`;
      await seedTestMail(api, address, {
        subject,
        html: '<h1>Welcome</h1><p>This is a <b>browser test</b> email.</p>',
      });

      // Login via JWT query param with /en/ path to force English locale
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);

      // The mail subject should be visible in the inbox list item
      const mailItem = page.getByRole('listitem').getByText(subject);
      await expect(mailItem).toBeVisible({ timeout: 10_000 });

      // Click to open the email
      await mailItem.click();

      // Verify the email detail panel shows the subject as a heading
      // (n-card-header wraps n-card-header__main, both match heading role — use .first())
      await expect(page.getByRole('heading', { name: subject }).first()).toBeVisible({ timeout: 5_000 });
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });
});
