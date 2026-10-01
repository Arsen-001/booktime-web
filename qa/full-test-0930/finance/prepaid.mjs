// Предоплата: окно оплаты просит только остаток, быстрая оплата проводит остаток, строка «Предоплата» в сводке
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/finance';
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch({ headless: true });
const log = (...a) => console.log(...a);
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  await page.goto(`${B}/biz/journal?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const pick = await page.evaluate(() => {
    const bookings = JSON.parse(localStorage.getItem('bp-mock-db:core:bookings') || 'null');
    const fin = JSON.parse(localStorage.getItem('bp-mock-db:area:finance') || 'null');
    const arr = bookings?.state ?? bookings;
    const list = Array.isArray(arr) ? arr : (arr?.bookings ?? arr?.data ?? []);
    const pays = (fin?.state ?? fin)?.bookingPayments ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const cands = list.filter((b) => b.prepayment?.paid && !b.deletedAt && ['scheduled', 'client_confirmed', 'arrived'].includes(b.status) && !pays.some((p) => p.bookingId === b.id));
    cands.sort((a, b) => Math.abs(new Date(a.start) - new Date(today)) - Math.abs(new Date(b.start) - new Date(today)));
    return { n: cands.length, keys: Object.keys(localStorage).filter((k) => k.startsWith('bp-mock')), b: cands[0] && { id: cands[0].id, start: cands[0].start, total: cands[0].total, prepayment: cands[0].prepayment, status: cands[0].status, businessId: cands[0].businessId } };
  });
  log(JSON.stringify(pick));
  if (!pick.b) throw new Error('no candidate');
  const date = pick.b.start.slice(0, 10);
  await page.goto(`${B}/biz/journal?demo=owner&lang=ru&date=${date}&booking=${pick.b.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/prepaid-01-window.png` });
  // вкладка оплаты
  const payTab = page.getByRole('tab', { name: /Оплат/ }).first();
  if (await payTab.count()) await payTab.click(); else await page.getByText(/^Оплата$/).first().click().catch(() => log('no pay tab'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/prepaid-02-pay.png`, fullPage: true });
  const txt = await page.locator('[data-f~="F-07-045"]').first().innerText().catch(() => 'NO F-07-045');
  log('SUMMARY:', txt.replace(/\n/g, ' | '));
  // быстрая оплата наличными
  const cash = page.locator('[data-f~="F-07-037"] button, button').filter({ hasText: /Наличн/ }).first();
  log('cash btn text:', await cash.innerText().catch(() => 'none'));
  await cash.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/prepaid-03-confirm.png` });
  const dlg = page.getByRole('dialog').last();
  log('DIALOG:', (await dlg.innerText()).replace(/\n/g, ' | '));
  await dlg.getByRole('button', { name: /Провести|Оплатить|Подтверд/ }).last().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/prepaid-04-after.png`, fullPage: true });
  log('AFTER:', (await page.locator('[data-f~="F-07-045"]').first().innerText().catch(() => '?')).replace(/\n/g, ' | '));
  const paid = await page.evaluate((id) => {
    const fin = JSON.parse(localStorage.getItem('bp-mock-db:area:finance'));
    const pays = (fin?.state ?? fin).bookingPayments.filter((p) => p.bookingId === id && !p.cancelled);
    return pays.reduce((s, p) => s + p.amount, 0);
  }, pick.b.id);
  log('PAID LINES SUM:', paid, 'expected', Math.min(pick.b.total, pick.b.total) - pick.b.prepayment.amount);
} finally {
  await browser.close();
  release();
}
