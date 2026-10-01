// Оплата визита (F-14-094…098, 102, 074). Подготовка: клиент подтверждает запись (ключ core:bookings
// появляется в localStorage), затем одна сегодняшняя запись Nuri получает статус «Пришёл» и клиента приложения.
import { start, newPage, go, shot, text } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
const one = (s, n = 600) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const body = (p) => p.locator('body').innerText();
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  await go(page, '/bookings/bk_0081', 'client');
  const cb = page.getByRole('button', { name: 'Подтвердить, что приду' });
  if (await cb.count()) { await cb.click(); await page.waitForTimeout(2000); }
  const prep = await page.evaluate(() => {
    const key = 'bp-mock-db:core:bookings';
    const raw = localStorage.getItem(key);
    if (!raw) return { err: 'no key', keys: Object.keys(localStorage).filter((k) => k.startsWith('bp-')).slice(0, 40) };
    const j = JSON.parse(raw);
    const arr = Array.isArray(j) ? j : j.state ?? j.items ?? j.data;
    if (!Array.isArray(arr)) return { err: 'shape', shape: Object.keys(j).slice(0, 10) };
    const me = arr.find((b) => b.id === 'bk_0081');
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const t = arr.find((b) => b.businessId === 'biz_nuri' && String(b.start).startsWith(today) && ['scheduled', 'client_confirmed'].includes(b.status));
    if (!t) return { err: 'no today', today, n: arr.length };
    t.status = 'arrived';
    t.appUserId = me?.appUserId;
    t.visitorName = 'Визит QA';
    localStorage.setItem(key, JSON.stringify(j));
    return { ok: t.id, appUser: me?.appUserId, total: t.total };
  });
  log('PREP:', JSON.stringify(prep));
  if (!prep.ok) throw new Error('prep failed');

  await go(page, '/biz/apps/reports', 'owner');
  await page.getByRole('tab', { name: 'Z-отчёт' }).click();
  await page.waitForTimeout(1500);
  const zt = await text(page);
  log('Z1 total:', one(zt.slice(zt.indexOf('Итого')), 120), 'has Гаяне Товмасян:', zt.includes('Гаяне Товмасян'));
  const st = await page.evaluate(() => { const j = JSON.parse(localStorage.getItem('bp-mock-db:core:bookings')); const a = Array.isArray(j) ? j : j.state ?? j.items ?? j.data; const b = a.find((x) => x.id === 'bk_4104'); return [b.status, b.start, b.staffId, b.total, b.deletedAt]; });
  log('bk_4104:', JSON.stringify(st), 'now', new Date().toString());
  await shot(page, 'v-z2');
  log('ERRORS:', errors.slice(0, 6));
} catch (e) {
  console.error('FAIL', e.message);
} finally {
  await done();
}
