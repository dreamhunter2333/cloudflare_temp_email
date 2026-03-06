import { test, expect } from '@playwright/test';
import {
  FRONTEND_URL,
  createTestAddress,
  seedTestMail,
  deleteAddress,
  deleteAllMailpitMessages,
  requestSendAccess,
} from '../../fixtures/test-helpers';
import { request as apiRequest } from '@playwright/test';

test.describe('Reply HTML & XSS Sanitization', () => {
  test('reply to HTML email — XSS payloads stripped, HTML preserved', async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt: string | undefined;

    try {
      await deleteAllMailpitMessages(api);

      const created = await createTestAddress(api, 'reply-xss');
      jwt = created.jwt;
      const address = created.address;

      // Request send access so Reply can navigate to compose form
      await requestSendAccess(api, jwt);

      // Seed email with XSS payloads embedded in HTML
      const xssHtml = [
        '<div>',
        '  <h1>Important Message</h1>',
        '  <p>Please review this content.</p>',
        '  <script>alert("xss")</script>',
        '  <img src=x onerror="alert(1)">',
        '  <a href="javascript:alert(2)">click me</a>',
        '  <p style="color:red">Styled paragraph</p>',
        '</div>',
      ].join('\n');

      await seedTestMail(api, address, {
        subject: 'XSS Test Email',
        html: xssHtml,
        from: 'attacker@test.example.com',
      });

      // Single dialog handler with phase tracking.
      // During email rendering, the mail viewer uses an unsandboxed iframe so
      // inline event handlers like onerror may fire — we dismiss those.
      // After clicking Reply, any dialog means the compose path failed to sanitize.
      let inComposePhase = false;
      let composeDialogAppeared = false;
      page.on('dialog', async (dialog) => {
        if (inComposePhase) composeDialogAppeared = true;
        await dialog.dismiss();
      });

      // Login with English locale
      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);

      // Open the email (use listitem to avoid strict mode violation
      // when detail panel also shows the subject)
      const mailItem = page.getByRole('listitem').getByText('XSS Test Email');
      await expect(mailItem).toBeVisible({ timeout: 10_000 });
      await mailItem.click();

      // Wait for Reply button to appear — signals email content has rendered
      const replyButton = page.locator('button').filter({ hasText: /Reply/i }).first();
      await expect(replyButton).toBeVisible({ timeout: 10_000 });

      // Click Reply — from here on, dialogs indicate sanitization failure (#857)
      inComposePhase = true;
      await replyButton.click();

      // In the reply compose area, check that the forwarded HTML is sanitized:
      // - <script> tags should be removed
      // - onerror attributes should be removed
      // - javascript: URLs should be removed
      const composeArea = page.locator('.ql-editor, [contenteditable], textarea').first();
      await expect(composeArea).toBeVisible({ timeout: 5_000 });

      // Use inputValue() for <textarea> (Vue v-model sets .value, not innerHTML),
      // fall back to innerHTML() for contenteditable elements
      const tagName = await composeArea.evaluate(el => el.tagName.toLowerCase());
      const content = tagName === 'textarea'
        ? await composeArea.inputValue()
        : await composeArea.innerHTML();

      // Verify content is non-empty (guard against vacuous pass)
      expect(content.length).toBeGreaterThan(0);

      // XSS vectors must be stripped
      expect(content).not.toContain('<script>');
      expect(content).not.toContain('onerror');
      expect(content).not.toContain('javascript:');

      // No XSS dialog should have fired in the compose area
      expect(composeDialogAppeared).toBe(false);
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });
});
