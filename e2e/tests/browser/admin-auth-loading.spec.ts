import { expect, test } from '@playwright/test';

import { FRONTEND_URL } from '../../fixtures/test-helpers';

test('waits for access settings before showing the Admin password dialog', async ({ page }) => {
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

  await expect(page.getByText('管理员密码', { exact: true })).toHaveCount(0);

  releaseSettings();
  await expect(page.getByText('快速设置', { exact: true })).toBeVisible();
  await expect(page.getByText('管理员密码', { exact: true })).toHaveCount(0);
});
