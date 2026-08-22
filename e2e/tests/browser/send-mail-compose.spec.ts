import { test, expect, request as apiRequest, type Page } from '@playwright/test';
import {
  FRONTEND_URL,
  createTestAddress,
  deleteAddress,
  requestSendAccess,
} from '../../fixtures/test-helpers';

const expectEditorOriginsToAlign = async (page: Page) => {
  const editorOriginDelta = await page.locator('.compose-textarea').evaluate((editor) => {
    const textareaElement = editor.querySelector('textarea');
    const placeholder = editor.querySelector('.n-input__placeholder');
    if (!textareaElement) throw new Error('compose textarea element not found');
    if (!placeholder) throw new Error('compose placeholder element not found');
    const textareaBox = textareaElement.getBoundingClientRect();
    const placeholderBox = placeholder.getBoundingClientRect();
    const textareaStyle = getComputedStyle(textareaElement);
    const placeholderStyle = getComputedStyle(placeholder);
    return {
      x: textareaBox.x + parseFloat(textareaStyle.paddingLeft)
        - placeholderBox.x - parseFloat(placeholderStyle.paddingLeft),
      y: textareaBox.y + parseFloat(textareaStyle.paddingTop)
        - placeholderBox.y - parseFloat(placeholderStyle.paddingTop),
    };
  });
  expect(Math.abs(editorOriginDelta.x)).toBeLessThan(1);
  expect(Math.abs(editorOriginDelta.y)).toBeLessThan(1);
};

test.describe('Send mail composer', () => {
  test('edits a draft, changes format, and previews HTML', async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt: string | undefined;

    try {
      const created = await createTestAddress(api, 'compose-ui');
      jwt = created.jwt;
      await requestSendAccess(api, jwt);

      await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);
      await page.getByText('Send Mail', { exact: true }).click();

      await expect(page.getByRole('heading', { name: 'Compose email', exact: true })).toBeVisible();
      await expect(page.locator('.composer-title')).toContainText(created.address);

      const expectedFieldOrder = [
        'send-mail-sender-address',
        'send-mail-sender-name',
        'send-mail-recipient-address',
        'send-mail-recipient-name',
      ];
      const fieldIds = await page.locator('.composer-form .n-grid input').evaluateAll(
        (inputs) => inputs.map((input) => input.id)
      );
      expect(fieldIds.filter((id) => expectedFieldOrder.includes(id))).toEqual(expectedFieldOrder);

      const textarea = page.locator('.compose-textarea textarea');
      await expectEditorOriginsToAlign(page);

      const recipient = page.getByRole('textbox', { name: /^Recipient address/ });
      const subject = page.getByRole('textbox', { name: /^Subject/ });
      await recipient.fill('recipient@test.example.com');
      await subject.fill('Composer preview');

      await page.getByText('HTML', { exact: true }).click();
      const htmlContent = [
        '<h1>Preview heading</h1><p>Preview body</p>',
        '<script>alert("xss")</script><img src="x" onerror="alert(1)">',
      ].join('');
      let previewDialogAppeared = false;
      page.on('dialog', async (dialog) => {
        previewDialogAppeared = true;
        await dialog.dismiss();
      });
      await textarea.fill(htmlContent);
      await page.getByRole('button', { name: 'Preview' }).click();

      const preview = page.locator('.compose-preview');
      await expect(preview).toBeVisible();
      await expect(preview).toContainText('Preview heading');
      await expect(preview.locator('script, [onerror]')).toHaveCount(0);
      expect(previewDialogAppeared).toBe(false);

      await page.getByRole('button', { name: 'Edit' }).click();
      await expect(preview).toBeHidden();
      await expect(recipient).toHaveValue('recipient@test.example.com');
      await expect(subject).toHaveValue('Composer preview');
      await expect(textarea).toHaveValue(htmlContent);

      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(`${FRONTEND_URL}/es/?jwt=${jwt}`);
      await page.getByText('Enviar correo', { exact: true }).click();

      await expect(page.getByRole('heading', { name: 'Redactar correo', exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /^Dirección del destinatario/ })).toBeVisible();
      await expect(page.getByText('Borrador guardado en este navegador', { exact: true })).toBeVisible();

      await page.getByText('HTML', { exact: true }).click();
      const previewButton = page.getByRole('button', { name: 'Vista previa', exact: true });
      await expect(previewButton).toBeVisible();
      const previewBox = await previewButton.boundingBox();
      expect(previewBox).not.toBeNull();
      expect(previewBox!.x + previewBox!.width).toBeLessThanOrEqual(320);
    } finally {
      try {
        if (jwt) await deleteAddress(api, jwt);
      } finally {
        await api.dispose();
      }
    }
  });

  test('keeps the Admin field order and editor placeholder aligned', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('adminAuth', 'e2e-admin-pass');
      sessionStorage.setItem('adminTab', 'mails');
    });
    await page.goto(`${FRONTEND_URL}/en/admin`);
    await page.getByText('Send Mail', { exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Compose email', exact: true })).toBeVisible();
    const expectedFieldOrder = [
      'admin-send-mail-sender-address',
      'admin-send-mail-sender-name',
      'admin-send-mail-recipient-address',
      'admin-send-mail-recipient-name',
    ];
    const fieldIds = await page.locator('.composer-form .n-grid input').evaluateAll(
      (inputs) => inputs.map((input) => input.id)
    );
    expect(fieldIds.filter((id) => expectedFieldOrder.includes(id))).toEqual(expectedFieldOrder);
    await expectEditorOriginsToAlign(page);
  });
});
