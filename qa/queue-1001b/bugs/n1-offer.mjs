// Проверка действием: чат поддержки из кабинета → панель; «Освободилось время» у клиента; плитка Telegram в окне записи
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001b/bugs';
const only = process.argv[2]?.split(',');
const want = (k) => !only || only.includes(k);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
const go = async (page, path, persona) => {
  await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=${persona}&data=mock`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(5000);
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('pageerror', e.message.slice(0, 200)));
  if (want('support')) {
    await go(page, '/biz/notifications/inbox', 'owner');
    await page.getByRole('tab', { name: /Новости сервиса/ }).first().click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /Чат с поддержкой/ }).first().click();
    await page.waitForTimeout(800);
    await page.getByPlaceholder('Что случилось?').fill('QA 01.10: вопрос из кабинета');
    await page.getByRole('button', { name: 'Отправить', exact: true }).click();
    await page.waitForTimeout(1500);
    await go(page, '/platform/support', 'platform');
    const row = page.getByText('QA 01.10: вопрос из кабинета').first();
    const around = await row.locator('xpath=ancestor::*[self::li or self::tr or self::a][1]').innerText().catch(() => '');
    log('support row:', around.replace(/\n/g, ' | ').slice(0, 300));
    log('support has Кабинет бизнеса:', (await page.getByText('Кабинет бизнеса').count()) > 0);
    await page.screenshot({ path: `${OUT}/n1-support-desktop.png` });
  }
  if (want('offer')) {
    await go(page, '/masters/st_nuri_ani', 'client');
    await page.getByRole('button', { name: 'Сообщить, если освободится' }).first().click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Встать в очередь' }).click();
    await page.waitForTimeout(1500);
    await go(page, '/biz/journal', 'owner');
    await page.getByRole('button', { name: 'Предложить окна' }).first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/n1-offer-sheet.png` });
    const send = page.getByRole('button', { name: /^Отправить \d+/ }).first();
    log('offer send button:', await send.innerText().catch(() => 'none'));
    await send.click();
    await page.waitForTimeout(2000);
    for (const [device, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
      await page.setViewportSize(vp);
      await go(page, '/notifications', 'client');
      const card = page.getByText(/Освободилось время/).first();
      log(device, 'notification text:', await card.innerText().catch(() => 'none'));
      await page.screenshot({ path: `${OUT}/n1-client-notif-${device}.png` });
    }
    const btn = page.locator('[data-f="F-00-101"]').first();
    log('book button:', await btn.count());
    await btn.click();
    await page.waitForTimeout(4000);
    log('after tap url:', page.url());
    await page.screenshot({ path: `${OUT}/n1-client-notif-book.png` });
  }
  await ctx.close();
} finally {
  await browser.close();
  release();
}
