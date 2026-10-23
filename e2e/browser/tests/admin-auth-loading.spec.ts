import { expect, test } from '@playwright/test';

import { FRONTEND_URL } from '../../fixtures/test-helpers';

test('waits for access settings before showing the Admin password dialog', async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as Window & { __adminPasswordRendered?: boolean };
    testWindow.__adminPasswordRendered = false;

    const detectAdminPassword = () => {
      const textNodes = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
      while (textNodes.nextNode()) {
        if (textNodes.currentNode.textContent?.trim() === '管理员密码') {
          testWindow.__adminPasswordRendered = true;
          return;
        }
      }
    };

    new MutationObserver(detectAdminPassword).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });

  let releaseSettings!: () => void;
  const settingsPending = new Promise<void>((resolve) => {
    releaseSettings = resolve;
  });
  let markSettingsRequested!: () => void;
  const settingsRequested = new Promise<void>((resolve) => {
    markSettingsRequested = resolve;
  });

  await page.route('**/open_api/settings', async (route) => {
    markSettingsRequested();
    await settingsPending;
    await route.continue();
  });

  await page.goto(`${FRONTEND_URL}/zh/admin`);
  await settingsRequested;

  try {
    await expect(page.getByText('管理员密码', { exact: true })).toHaveCount(0);
  } finally {
    releaseSettings();
  }

  await expect(page.getByText('快速设置', { exact: true })).toBeVisible();
  await expect(page.getByText('管理员密码', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (
    window as Window & { __adminPasswordRendered?: boolean }
  ).__adminPasswordRendered)).toBe(false);
});
