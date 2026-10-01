// Проверка действием: пересечение записей у клиента; «Оплатить» в «Списке» → финансы; плитка Telegram в окне записи
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/leftovers';
const only = process.argv[2]?.split(',');
const want = (k) => !only || only.includes(k);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
const go = async (page, path, persona) => {
  await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=${persona}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(5000);
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('pageerror', e.message.slice(0, 200)));
  if (want('overlap')) {
    await go(page, '/bookings', 'client');
    const upcoming = await page.locator('main').innerText();
    log('client upcoming (head):', upcoming.replace(/\n/g, ' | ').slice(0, 400));
    for (const [device, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
      await page.setViewportSize(vp);
      await go(page, '/book?staff=st_nuri_ani&service=sv_nuri_classic&slot=' + encodeURIComponent(process.env.SLOT ?? '2026-10-02T17:00'), 'client');
      const warn = page.getByText(/У вас уже есть запись в это время/).first();
      log(device, 'overlap warning:', await warn.innerText().catch(() => 'none'));
      await page.screenshot({ path: `${OUT}/v3-overlap-${device}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  if (want('listpay')) {
    await go(page, '/biz/finance', 'owner');
    const before = (await page.locator('main').innerText()).replace(/\n/g, ' | ').slice(0, 500);
    log('finance before:', before);
    let paid = false;
    for (let d = 29; d >= 17 && !paid; d--) {
      const date = `2026-09-${String(d).padStart(2, '0')}`;
      await go(page, `/biz/journal?date=${date}`, 'owner');
      await page.getByRole('button', { name: /Список/ }).or(page.getByRole('radio', { name: /Список/ })).first().click();
      await page.waitForTimeout(2500);
      const payBtns = page.getByRole('button', { name: /^Оплатить$/ });
      const n = await payBtns.count();
      if (!n) continue;
      const row = payBtns.first().locator('xpath=ancestor::li[1]');
      log(date, 'pay buttons:', n, 'row:', (await row.innerText().catch(() => '')).replace(/\n/g, ' | ').slice(0, 160));
      await payBtns.first().click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT}/v3-list-paid.png` });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(6000);
      await page.getByRole('button', { name: /Список/ }).or(page.getByRole('radio', { name: /Список/ })).first().click().catch(() => {});
      await page.waitForTimeout(2500);
      log('after reload pay buttons:', await page.getByRole('button', { name: /^Оплатить$/ }).count());
      await page.screenshot({ path: `${OUT}/v3-list-after.png` });
      paid = true;
    }
    await go(page, '/biz/finance', 'owner');
    log('finance after:', (await page.locator('main').innerText()).replace(/\n/g, ' | ').slice(0, 500));
    await page.screenshot({ path: `${OUT}/v3-finance-after.png` });
  }
  if (want('tile')) {
    await go(page, '/biz/journal?date=2026-10-04&booking=bk_0081', 'owner');
    await page.waitForTimeout(3000);
    await page.getByRole('tab', { name: 'Уведомления' }).click();
    await page.waitForTimeout(1500);
    const tg = page.getByText('За сутки и за 2 часа', { exact: false }).first();
    await tg.scrollIntoViewIfNeeded().catch(() => {});
    log('telegram tile:', (await tg.count()) > 0 ? 'OK' : 'NO');
    await page.screenshot({ path: `${OUT}/v3-tile-desktop.png` });
  }
  await ctx.close();
} finally {
  await browser.close();
  release();
}
