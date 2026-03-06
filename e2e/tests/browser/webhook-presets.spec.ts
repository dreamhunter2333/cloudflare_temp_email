import { test, expect } from '@playwright/test';
import { FRONTEND_URL, createTestAddress, deleteAddress } from '../../fixtures/test-helpers';
import { request as apiRequest } from '@playwright/test';

test.describe('Webhook Presets', () => {
  test('selecting each preset fills valid settings', async ({ page, context }) => {
    test.setTimeout(60_000);

    const api = await apiRequest.newContext();
    const { jwt, address } = await createTestAddress(api, 'webhook-preset');

    // Block popups (presets open doc URLs in new tabs)
    context.on('page', (p) => p.close());

    try {
      // Login via JWT
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);
      await page.waitForTimeout(2000);

      // Click "Webhook Settings" in the sidebar menu
      await page.getByText('Webhook Settings').click();
      await page.waitForTimeout(2000);

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
        await page.waitForTimeout(500);
        await page.locator('.n-dropdown-option', { hasText: preset.name }).click();
        await page.waitForTimeout(1000);

        // Get all textbox values on the page — URL is the first input-type textbox
        // From the DOM snapshot: URL textbox, HEADERS textbox, BODY textbox
        const allTextboxes = page.getByRole('textbox');
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
      await deleteAddress(api, jwt);
      await api.dispose();
    }
  });
});
