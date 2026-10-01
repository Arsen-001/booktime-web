// №1 в браузере (мок): клиент встал в очередь к Ани → владелец «Найти окно» на завтра → «Предложить» → лента клиента
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001b/bugs';
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
  // Клиент встаёт в лист к Соне (у неё есть свободное время в сб) на гель-лак, любой день
  const svc = 'Маникюр с покрытием гель-лаком';
  const ahead = Number(process.env.AHEAD ?? 2);
  await go(page, '/masters/st_nuri_sona', 'client');
  const cta = page.getByRole('button', { name: 'Сообщить, если освободится' }).first();
  await cta.click({ timeout: 120000 });
  await page.waitForTimeout(1000);
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('combobox').first().click();
  await page.getByRole('option', { name: svc }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/n1-client-waitlist.png` });
  await dlg.getByRole('button', { name: 'Встать в очередь' }).click();
  await page.waitForTimeout(1500);
  await go(page, '/biz/journal', 'owner');
  for (let i = 0; i < ahead; i++) {
    await page.getByRole('button', { name: 'Следующий день' }).first().click();
    await page.waitForTimeout(2000);
  }
  await page.getByRole('button', { name: 'Найти окно' }).first().click();
  await page.waitForTimeout(1000);
  await page.getByPlaceholder(/Найти услугу/).fill(svc.slice(0, 14));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/n1-findslot-search.png` });
  await page.getByText(svc, { exact: true }).last().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/n1-findslot.png` });
  await page.getByRole('button', { name: /Предложить (это окно|все окна)/ }).first().click();
  await page.waitForTimeout(2000);
  const send = page.getByRole('button', { name: /^Отправить \d+/ }).first();
  log('кнопка отправки:', await send.innerText().catch(() => 'none'));
  await send.click();
  await page.waitForTimeout(2000);
  for (const [device, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
    await page.setViewportSize(vp);
    await go(page, '/notifications', 'client');
    log(device, 'текст:', await page.getByText(/Освободилось время/).first().innerText().catch(() => 'none'));
    await page.screenshot({ path: `${OUT}/n1-client-notif-${device}.png` });
  }
  const btn = page.locator('[data-f="F-00-101"]').first();
  log('кнопок «Записаться»:', await btn.count());
  await btn.click();
  await page.waitForTimeout(5000);
  log('после нажатия:', page.url());
  await page.screenshot({ path: `${OUT}/n1-client-book.png` });
  await ctx.close();
} finally {
  await browser.close();
  release();
}
