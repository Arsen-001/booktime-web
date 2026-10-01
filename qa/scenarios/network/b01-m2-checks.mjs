import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const log = (...a) => console.log(...a);

async function shot(page, name) {
  await page.screenshot({ path: `qa/shots/network-b01-m2-checks/${name}.png`, fullPage: true });
}

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') log('[console.error]', m.text()); });
    page.on('pageerror', (e) => log('[pageerror]', e.message));

    // A. F-11-024: pencil opens user card in "Пользователи сети"
    await page.goto(`${BASE}/biz/network/settings/users?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, 'a-users-list');
    const editBtn = page.locator('button[aria-label*="Редактировать" i], button[aria-label*="Изменить" i], [aria-label*="редакт" i]').first();
    const editCount = await editBtn.count();
    log('A: edit buttons found:', editCount);
    if (editCount) {
      await editBtn.click();
      await page.waitForTimeout(800);
      const dialog = page.locator('[role="dialog"]');
      log('A: dialog visible after edit click:', await dialog.count());
      await shot(page, 'a-users-edit-card');
    }

    // B. F-11-005 permission: persona without network.manage -> "Сети" empty ("вас не добавили")
    await page.goto(`${BASE}/biz/network/switch?demo=master&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    log('B: master sees "не добавили" text:', bodyText.includes('не добавили') || bodyText.toLowerCase().includes('не добавлен'));
    await shot(page, 'b-switch-master');

    // C. F-11-003 recheck: nav submenu scroll on staff page, desktop
    await page.goto(`${BASE}/biz/network/staff?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const activeLink = page.locator('a[aria-current="page"]').first();
    const box = await activeLink.boundingBox().catch(() => null);
    log('C: active submenu link boundingBox:', box, 'viewport height 900');
    await shot(page, 'c-staff-menu');

    // D. F-11-146 telephony token copy visible
    await page.goto(`${BASE}/biz/network/telephony?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const tokenText = await page.locator('body').innerText();
    log('D: telephony has NET- token text:', /NET-/.test(tokenText));
    await shot(page, 'd-telephony');

    await ctx.close();
  } finally {
    await browser.close();
    release();
  }
}

main().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
