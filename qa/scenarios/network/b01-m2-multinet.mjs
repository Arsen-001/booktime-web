import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const log = (...a) => console.log(...a);

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') log('[console.error]', m.text()); });
    page.on('pageerror', (e) => log('[pageerror]', e.message));

    // 1. Open switch, note current network name
    await page.goto(`${BASE}/biz/network/switch?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    const beforeNames = await page.locator('[data-f="F-11-005 F-11-021"] ul li span.truncate').allTextContents();
    log('networks before:', beforeNames);

    // 2. Create a second network via +Добавить (F-11-014)
    await page.goto(`${BASE}/biz/network/new?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.fill('input[name], input#name, input', 'Тестовая сеть QA-m2').catch(() => {});
    // fallback: find text input near label "Название"
    const nameInput = page.locator('input').first();
    await nameInput.fill('Тестовая сеть QA-m2');
    // check first available location checkbox
    const firstCheckbox = page.locator('input[type="checkbox"], [role="checkbox"]').first();
    if (await firstCheckbox.count()) {
      await firstCheckbox.click();
    }
    await page.screenshot({ path: 'qa/shots/network-b01-m2-multinet/new-network-filled.png', fullPage: true });
    const saveBtn = page.getByRole('button', { name: /Создать|Сохранить/i });
    await saveBtn.click();
    await page.waitForTimeout(1500);
    log('after create URL:', page.url());
    await page.screenshot({ path: 'qa/shots/network-b01-m2-multinet/after-create.png', fullPage: true });

    // 3. Back to switch, expect 2 networks
    await page.goto(`${BASE}/biz/network/switch?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    const afterNames = await page.locator('[data-f="F-11-005 F-11-021"] ul li span.truncate').allTextContents();
    log('networks after create:', afterNames);
    await page.screenshot({ path: 'qa/shots/network-b01-m2-multinet/switch-two-networks.png', fullPage: true });

    // 4. Click the SECOND network's row button (not settings/delete) and see what happens
    const rows = page.locator('[data-f="F-11-005 F-11-021"] ul li');
    const count = await rows.count();
    log('row count:', count);
    if (count >= 2) {
      const secondRowNameBtn = rows.nth(1).locator('button').first();
      const secondName = await rows.nth(1).locator('span.truncate').textContent();
      log('clicking second network row:', secondName);
      await secondRowNameBtn.click();
      await page.waitForTimeout(1000);
      log('URL after clicking 2nd network row:', page.url());
      const headerTitle = await page.locator('h1, [data-f="F-11-001"] h1, header').first().textContent().catch(() => '');
      log('page content after click (title guess):', headerTitle);
      await page.screenshot({ path: 'qa/shots/network-b01-m2-multinet/after-click-second-network.png', fullPage: true });
      // Check which network is actually shown: look for network name text on /biz/network page
      const bodyText = await page.locator('body').innerText();
      log('does body contain second network name?', bodyText.includes(secondName?.trim() ?? '###'));
    }

    // 5. Cleanup: delete the test network we created (go to its settings) - but settings always points to CURRENT network,
    // so first verify which network is "current" now
    await page.goto(`${BASE}/biz/network/settings?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    const settingsTitle = await page.locator('h1, [class*="PageHeader"] h1').first().textContent().catch(() => '');
    log('settings screen shows network name in fields, title:', settingsTitle);
    const nameFieldVal = await page.locator('input').first().inputValue().catch(() => '');
    log('settings name field value:', nameFieldVal);
    await page.screenshot({ path: 'qa/shots/network-b01-m2-multinet/settings-current.png', fullPage: true });

    await ctx.close();
  } finally {
    await browser.close();
    release();
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
