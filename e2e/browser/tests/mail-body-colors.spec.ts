import { test, expect, request as apiRequest, type Locator } from '@playwright/test';
import { FRONTEND_URL, createTestAddress, seedTestMail, deleteAddress } from '../../fixtures/test-helpers';

const textContrast = (locator: Locator) => locator.evaluate(element => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d')!;
  const rgba = (color: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const blend = (color: number[], background: number[]) => color.slice(0, 3)
    .map((value, index) => value * color[3] + background[index] * (1 - color[3]));
  const ancestors: Element[] = [];
  for (let node: Element | null = element; node;) {
    ancestors.unshift(node);
    const root = node.getRootNode();
    node = node.parentElement || (root instanceof ShadowRoot ? root.host : null);
  }
  const background = ancestors.reduce((color, node) =>
    blend(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
  const foreground = blend(rgba(getComputedStyle(element).color), background);
  const luminance = (color: number[]) => color.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
});

for (const [fallback, colorScheme] of [
  [false, 'light'], [false, 'dark'], [true, 'light'], [true, 'dark'],
] as const) {
  test(`HTML mail document colors (fallback: ${fallback}, browser: ${colorScheme})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme });
    const api = await apiRequest.newContext();
    const mailbox = await createTestAddress(api, 'body-colors');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await seedTestMail(api, mailbox.address, { subject: 'Document colors', text: 'Readable plain text.', html: `
        <p id="unstyled">Unstyled text</p>
        <div style="color: black"><p><span id="black">Explicit black text</span></p></div>
        <table><tr><td id="cell" style="color: black">Black table text</td></tr></table>
        <div style="background: white"><a id="link" href="https://example.com">Default link</a></div>
        <div id="panel" style="color: white; background: #222">Sender dark panel
          <a id="authored" href="https://example.org" style="color: #ffcc00">Sender link</a>
        </div>
        <div id="yellow-panel" style="color: black; background: #ffcc00">Sender yellow panel</div>
        <style>
          .sender-link { color: #996600; }
          @media (prefers-color-scheme: dark) { .sender-media { color: white !important; } }
        </style>
        <a id="stylesheet-link" class="sender-link" href="https://example.org">Sender stylesheet link</a>
        <div style="background: white"><p id="media" class="sender-media" style="color: #101214">Sender media query</p></div>
        <p id="local-variable" style="--reader-test-color: #ffcc00; color: var(--reader-test-color)">Sender variable</p>` });
      await seedTestMail(api, mailbox.address, { subject: 'Empty document', html: '<!-- Empty HTML document -->' });
      await seedTestMail(api, mailbox.address, { subject: 'Replacement document', html: '<p id="replacement">Replacement text</p>' });
      await page.setViewportSize({ width: 1360, height: 900 });
      await page.addInitScript(disableShadow => {
        if (window.top !== window) return;
        localStorage.setItem('useIframeShowMail', 'false');
        localStorage.setItem('preferShowTextMail', 'false');
        localStorage.setItem('vueuse-color-scheme', 'dark');
        if (disableShadow) Object.defineProperty(Element.prototype, 'attachShadow', { value: undefined, configurable: true });
      }, fallback);
      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      await page.getByRole('listitem').filter({ hasText: 'Document colors' }).click();
      const reader = page.locator('.mail-content-renderer');
      const colorsByView = new Map();
      for (const theme of ['dark', 'light']) {
        if (theme === 'light') {
          await page.getByRole('button', { name: 'Light', exact: true }).click();
        }
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
        for (const fullscreen of [false, true]) {
          if (fullscreen) {
            await reader.getByRole('button', { name: 'More actions', exact: true }).click();
            await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
          }
          const root = fullscreen ? page.locator('.fullscreen-mail-content') : reader;
          const canvas = root.locator('.mail-boundary');
          await expect(canvas).toHaveCSS('color-scheme', 'normal');
          await expect(canvas).toHaveCSS('color', 'rgb(0, 0, 0)');
          await expect(canvas).toHaveCSS('background-color', 'rgb(255, 255, 255)');
          expect(await root.locator('.mail-document').evaluate(element => Boolean(element.shadowRoot))).toBe(!fallback);
          for (const id of ['unstyled', 'black', 'cell', 'link']) {
            await expect(root.locator(`#${id}`)).toBeVisible();
            expect(await textContrast(root.locator(`#${id}`))).toBeGreaterThanOrEqual(4.5);
          }
          await expect(root.locator('#black')).toHaveCSS('color', 'rgb(0, 0, 0)');
          await expect(root.locator('#cell')).toHaveCSS('color', 'rgb(0, 0, 0)');
          await expect(root.locator('#local-variable')).toHaveCSS('color', 'rgb(255, 204, 0)');
          await expect(root.locator('#panel')).toHaveCSS('color', 'rgb(255, 255, 255)');
          await expect(root.locator('#panel')).toHaveCSS('background-color', 'rgb(34, 34, 34)');
          await expect(root.locator('#authored')).toHaveCSS('color', 'rgb(255, 204, 0)');
          await expect(root.locator('#yellow-panel')).toHaveCSS('color', 'rgb(0, 0, 0)');
          await expect(root.locator('#yellow-panel')).toHaveCSS('background-color', 'rgb(255, 204, 0)');
          await expect(root.locator('#stylesheet-link')).toHaveCSS('color', 'rgb(153, 102, 0)');
          await expect(root.locator('#media')).toHaveCSS('color', colorScheme === 'dark'
            ? 'rgb(255, 255, 255)' : 'rgb(16, 18, 20)');
          if (colorScheme === 'dark') expect(await textContrast(root.locator('#media'))).toBe(1);
          const colors = await canvas.evaluate(element => {
            const style = getComputedStyle(element);
            return [style.color, style.backgroundColor];
          });
          if (theme === 'dark') colorsByView.set(fullscreen, colors);
          else expect(colors).toEqual(colorsByView.get(fullscreen));
          await expect(page.getByText('loading...', { exact: true })).not.toBeVisible();
          await page.screenshot({ path: testInfo.outputPath(`${theme}-${fullscreen ? 'fullscreen' : 'normal'}.png`), animations: 'disabled' });
          if (fullscreen) await page.locator('.n-drawer-header__close').last().click();
        }
      }
      await page.getByRole('button', { name: 'Dark', exact: true }).click();
      await expect(page.locator('html')).toHaveClass(/dark/);
      await page.getByRole('listitem').filter({ hasText: 'Empty document' }).click();
      await expect(reader.locator('.mail-document')).toHaveText('');
      await page.getByRole('listitem').filter({ hasText: 'Replacement document' }).click();
      await expect(reader.locator('#replacement')).toBeVisible();
      expect(await textContrast(reader.locator('#replacement'))).toBeGreaterThanOrEqual(4.5);
      await page.getByRole('listitem').filter({ hasText: 'Document colors' }).click();
      await reader.getByRole('button', { name: 'More actions', exact: true }).click();
      await page.getByRole('button', { name: 'Show Text Mail', exact: true }).click();
      await expect(reader.locator('.mail-text')).toHaveText('Readable plain text.');
      expect(await textContrast(reader.locator('.mail-text'))).toBeGreaterThanOrEqual(4.5);
      await reader.getByRole('button', { name: 'More actions', exact: true }).click();
      await page.getByRole('button', { name: 'Show HTML Mail', exact: true }).click();
      await page.evaluate(() => {
        localStorage.setItem('useIframeShowMail', 'true');
        window.dispatchEvent(new StorageEvent('storage', { key: 'useIframeShowMail', newValue: 'true', storageArea: localStorage }));
      });
      await expect(reader.locator('.mail-iframe')).toBeVisible();
      expect(await textContrast(reader.frameLocator('.mail-iframe').locator('#unstyled'))).toBeGreaterThanOrEqual(4.5);
      expect(errors).toEqual([]);
    } finally {
      try {
        await deleteAddress(api, mailbox.jwt);
      } finally {
        await api.dispose();
      }
    }
  });
}
