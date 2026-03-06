import { test, expect } from '@playwright/test';
import { FRONTEND_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';
import { request as apiRequest } from '@playwright/test';

test.describe('Webhook Presets', () => {
  test('selecting each preset fills valid settings', async ({ page, context }) => {
    test.setTimeout(60_000);

    const api = await apiRequest.newContext();
    let jwt: string | undefined;

    // Block popups (presets open doc URLs in new tabs)
    context.on('page', (p) => p.close());

    try {
      const created = await createTestAddress(api, 'webhook-preset');
      jwt = created.jwt;

      // Login via JWT
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);

      // Click "Webhook Settings" in the sidebar menu
      const webhookMenu = page.getByText('Webhook Settings');
      await expect(webhookMenu).toBeVisible({ timeout: 10_000 });
      await webhookMenu.click();

      // Verify presets button is visible
      const presetsBtn = page.getByRole('button', { name: 'Presets' });
      await expect(presetsBtn).toBeVisible({ timeout: 5000 });

      // Helper to get form field value by label text
      const getFieldValue = async (label: string): Promise<string> => {
        // Find the label, then get the sibling textbox in the same form row
        const row = page.locator('div', { hasText: new RegExp(`^${label}$`) }).locator('..');
        const textbox = row.getByRole('textbox');
        return textbox.inputValue();
      };

      // Define expected presets and their key fields
      const expectedPresets = [
        {
          name: 'Message Pusher',
          urlPattern: 'msgpusher.com',
          bodyKeys: ['token', 'title', 'description', 'content'],
        },
        {
          name: 'Bark',
          urlPattern: 'api.day.app',
          bodyKeys: ['title', 'body', 'group'],
        },
        {
          name: 'ntfy',
          urlPattern: 'ntfy.sh',
          bodyKeys: ['topic', 'title', 'message', 'tags'],
        },
      ];

      for (const preset of expectedPresets) {
        // Open dropdown and select preset
        await presetsBtn.click();
        const option = page.locator('.n-dropdown-option', { hasText: preset.name });
        await expect(option).toBeVisible({ timeout: 5_000 });
        await option.click();

        // Wait for preset values to be applied to form fields
        const allTextboxes = page.getByRole('textbox');
        await expect(async () => {
          const values = await allTextboxes.allInputValues();
          expect(values.some(v => v.includes(preset.urlPattern))).toBe(true);
        }).toPass({ timeout: 5_000 });
        const count = await allTextboxes.count();

        // Find URL, HEADERS, BODY values by reading all textboxes
        let urlValue = '';
        let headersValue = '';
        let bodyValue = '';

        for (let i = 0; i < count; i++) {
          const val = await allTextboxes.nth(i).inputValue();
          if (val.includes(preset.urlPattern)) {
            urlValue = val;
          } else if (val.includes('Content-Type')) {
            headersValue = val;
          } else if (val.includes('${subject}')) {
            bodyValue = val;
          }
        }

        // Verify URL
        expect(urlValue, `${preset.name}: URL should contain ${preset.urlPattern}`).toContain(preset.urlPattern);

        // Verify HEADERS is valid JSON with Content-Type
        expect(headersValue, `${preset.name}: HEADERS should not be empty`).toBeTruthy();
        const headers = JSON.parse(headersValue);
        expect(headers, `${preset.name}: headers should have Content-Type`).toHaveProperty('Content-Type', 'application/json');

        // Verify BODY is valid JSON with expected keys
        expect(bodyValue, `${preset.name}: BODY should not be empty`).toBeTruthy();
        const body = JSON.parse(bodyValue);
        for (const key of preset.bodyKeys) {
          expect(body, `${preset.name}: body should have key "${key}"`).toHaveProperty(key);
        }
      }
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });
});
