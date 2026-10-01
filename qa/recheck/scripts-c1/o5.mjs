import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
async function toDetails(page, time) {
  await page.getByText('Маникюр классический', { exact: true }).first().click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продолжить/ }).click(); await page.waitForTimeout(1200);
  await page.getByText('Ани Саргсян').first().click(); await page.waitForTimeout(800);
  if (await page.getByRole('button', { name: 'Понятно' }).count()) await page.getByRole('button', { name: 'Понятно' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продолжить/ }).click(); await page.waitForTimeout(1500);
  log('times', (await page.getByRole('button', { name: /^\d\d:\d\d$/ }).allInnerTexts()).join(' '));
  await page.getByRole('button', { name: time }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продолжить/ }).click(); await page.waitForTimeout(1200);
}
async function fill(page, name, phone) {
  await page.getByPlaceholder('Введите имя').fill(name);
  await page.locator('input[type=tel]').fill(phone);
  await page.locator('input[type=checkbox]').last().check({ force: true });
}
const { page } = await open('guest', '/b/nuri-nail-studio/book', { device: 'phone' });
const d0 = await db(page);
log('cl_012', JSON.stringify(d0.core.clients.find(c=>c.id==='cl_012')).slice(0,200));
await toDetails(page, '15:30');
await fill(page, 'Новый Клиент', '93 12-34-56');
await page.getByRole('button', { name: 'Записаться' }).click(); await page.waitForTimeout(3000);
log('booked ->', (await text(page)).slice(0, 120).replace(/\n/g,' | '), 'URL', page.url());
const links = await page.locator('a').evaluateAll(as => as.map(a => a.textContent.trim() + ' -> ' + a.getAttribute('href')));
log('links', links.filter(l=>/Перенести|Отменить|Записаться ещё|календарь/.test(l)));
const d1 = await db(page);
const nb = d1.core.bookings.find(b=>b.staffId==='st_nuri_ani' && b.start==='2026-09-25T15:30');
const nc = d1.core.clients.find(c=>c.id===nb?.clientId);
log('booking', JSON.stringify(nb && [nb.id, nb.status, nb.source]), 'client', JSON.stringify(nc && [nc.name, nc.phone]));
log('online bookingMeta', JSON.stringify(d1.areas.online.bookingMeta?.[nb?.id] ?? Object.entries(d1.areas.online.bookingMeta||{}).slice(-1)).slice(0,300));
// again same slot sequentially in same tab
await go(page, '/b/nuri-nail-studio/book');
await toDetails(page, '15:30').catch(e=>log('15:30 not offered anymore (good):', e.message.slice(0,60)));
await shot(page, 'o5-after');
log('ERR', page.errors.slice(0,3));
await stop();
