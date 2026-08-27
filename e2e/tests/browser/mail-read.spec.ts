import { expect, request as apiRequest, test } from '@playwright/test';

import {
  FRONTEND_URL,
  WORKER_URL,
  createTestAddress,
  deleteAddress,
  seedTestMail,
} from '../../fixtures/test-helpers';

test('keeps refresh unread and supports automatic and manual state changes', async ({ page }) => {
  const request = await apiRequest.newContext();
  let jwt: string | undefined;
  try {
    const mailbox = await createTestAddress(request, 'mail-read-browser');
    jwt = mailbox.jwt;
    const subject = `Unread browser mail ${Date.now()}`;
    await seedTestMail(request, mailbox.address, { subject });

    await page.goto(`${FRONTEND_URL}/en/`);
    await page.evaluate(() => localStorage.setItem('mailListView', 'true'));
    await page.goto(`${FRONTEND_URL}/en/?jwt=${jwt}`);
    await expect(page.getByText(subject, { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.getByText(subject, { exact: true })).toBeVisible({ timeout: 10_000 });
    const list = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const mail = (await list.json()).results.find((item: any) => item.raw.includes(subject));
    expect(mail.is_unread).toBe(1);
    await expect(page.locator('.mail-list-unread').filter({ hasText: subject })).toBeVisible();

    await page.route('**/api/mails/*/read', async route => {
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.continue();
    });
    const waitForReadUpdate = (isUnread: boolean) => page.waitForResponse(response =>
      /\/api\/mails\/\d+\/read$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'PATCH'
      && response.request().postDataJSON().isUnread === isUnread
    );
    const readResponse = waitForReadUpdate(false);
    await page.getByText(subject, { exact: true }).click();
    expect(await page.locator('.mail-list-unread').filter({ hasText: subject }).count()).toBe(0);
    expect(await page.locator('.n-spin-content--spinning').count()).toBe(0);
    await expect(page.getByRole('button', { name: 'Mark as Unread' })).not.toHaveClass(/n-button--loading/);
    expect((await readResponse).ok()).toBe(true);
    await expect(page.getByRole('button', { name: 'Mark as Unread' })).not.toHaveClass(/n-button--loading/);

    const unreadResponse = waitForReadUpdate(true);
    await page.getByRole('button', { name: 'Mark as Unread' }).click();
    expect(await page.locator('.mail-list-unread').filter({ hasText: subject }).count()).toBe(1);
    expect(await page.locator('.n-spin-content--spinning').count()).toBe(0);
    await expect(page.getByRole('button', { name: 'Mark as Read' })).toHaveClass(/n-button--loading/);
    expect((await unreadResponse).ok()).toBe(true);
    await expect(page.getByRole('button', { name: 'Mark as Read' })).not.toHaveClass(/n-button--loading/);

    const manualReadResponse = waitForReadUpdate(false);
    await page.getByRole('button', { name: 'Mark as Read' }).click();
    expect(await page.locator('.mail-list-unread').filter({ hasText: subject }).count()).toBe(0);
    expect(await page.locator('.n-spin-content--spinning').count()).toBe(0);
    await expect(page.getByRole('button', { name: 'Mark as Unread' })).toHaveClass(/n-button--loading/);
    expect((await manualReadResponse).ok()).toBe(true);
    await expect(page.getByRole('button', { name: 'Mark as Unread' })).not.toHaveClass(/n-button--loading/);

    const updatedList = await request.get(`${WORKER_URL}/api/mails?limit=10&offset=0`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const updatedMail = (await updatedList.json()).results.find((item: any) => item.id === mail.id);
    expect(updatedMail.is_unread).toBe(0);
  } finally {
    try {
      if (jwt) await deleteAddress(request, jwt);
    } finally {
      await request.dispose();
    }
  }
});
