import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { FRONTEND_URL } from '../../fixtures/test-helpers';

const installLocaleInitScript = async (page: Page, locales: string[], preferredLocale: string | null = null) => {
  await page.addInitScript(
    ({ locales: initialLocales, preferredLocale: initialPreferredLocale }: { locales: string[]; preferredLocale: string | null }) => {
      window.localStorage.removeItem('preferredLocale');
      if (initialPreferredLocale) {
        window.localStorage.setItem('preferredLocale', initialPreferredLocale);
      }

      Object.defineProperty(window.navigator, 'language', {
        configurable: true,
        get: () => initialLocales[0],
      });
      Object.defineProperty(window.navigator, 'languages', {
        configurable: true,
        get: () => initialLocales,
      });
    },
    { locales, preferredLocale },
  );
};

const selectLanguage = async (page: Page, selectTrigger: Locator, optionLabel: string) => {
  await selectTrigger.click();
  const option = page.locator('.n-dropdown-option, .n-dropdown-option-body').filter({ hasText: optionLabel }).first();
  await expect(option).toBeVisible();
  await option.click();
};

test.describe('Locale switching', () => {
  test('redirects first visit using browser language', async ({ page }) => {
    await installLocaleInitScript(page, ['es-ES', 'en-US']);

    await page.goto(`${FRONTEND_URL}/`);

    await expect(page).toHaveURL(`${FRONTEND_URL}/es/`);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('preferredLocale'))).toBe('es');
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('es');
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('desktop header switch removes default locale prefix and keeps query/hash', async ({ page }) => {
    await installLocaleInitScript(page, ['en-US'], 'en');

    await page.goto(`${FRONTEND_URL}/en/?tab=mail#top`);

    const headerLocaleDropdown = page.getByRole('button', { name: /English/ }).first();
    await selectLanguage(page, headerLocaleDropdown, '中文');

    await expect(page).toHaveURL(`${FRONTEND_URL}/?tab=mail#top`);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('preferredLocale'))).toBe('zh');
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('zh');
  });

  test('mobile drawer switch updates locale route and persisted preference', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 844 });
    await installLocaleInitScript(page, ['zh-CN']);

    await page.goto(`${FRONTEND_URL}/`);

    await page.getByRole('button', { name: /菜单|Menu/i }).click();

    const drawerLocaleDropdown = page.locator('.n-drawer').getByRole('button', { name: /中文|English|Español|Português|日本語|Deutsch/ }).first();
    await selectLanguage(page, drawerLocaleDropdown, 'Deutsch');

    await expect(page).toHaveURL(`${FRONTEND_URL}/de/`);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('preferredLocale'))).toBe('de');
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('de');
  });
});
