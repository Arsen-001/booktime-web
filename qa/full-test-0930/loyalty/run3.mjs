// Полный тест 30.09 · loyalty: лояльность в оплате визита (журнал / финансы) + экраны раздела.
// node qa/full-test-0930/loyalty/main.mjs [--only A,B,...]
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import { makeT, today, addDays } from '/Users/arsen/WebstormProjects/booking-platform/qa/e2e/lib.mjs';

const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/loyalty';
const only = null; const ONLY_IDS = ['R6'];
const BIZ = 'biz_nuri';
const results = [];
const log = (...a) => console.log(...a);
const flat = (s) => String(s ?? '').replace(/\n+/g, ' · ');

const release = await acquireBrowserSlot({ timeoutMs: 4 * 3600_000 });
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push('console: ' + m.text().slice(0, 200)); });
const t = makeT(page, 'loy', {});
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` }).catch(() => {});

async function step(id, title, fn) {
  if (!ONLY_IDS.includes(id)) return;
  const errs = pageErrors.length;
  const r = { id, title, status: 'pass', notes: [] };
  t.notes = [];
  try {
    await fn();
  } catch (e) {
    r.status = 'fail';
    r.error = String(e.message ?? e).slice(0, 600);
    await shot(`fail-${id}`);
  }
  r.notes = [...t.notes];
  if (pageErrors.length > errs) r.pageErrors = pageErrors.slice(errs);
  results.push(r);
  log(`${r.status === 'pass' ? '✓' : '✗'} ${id} ${title}${r.error ? ' — ' + r.error : ''}`);
  for (const n of r.notes) log('    ·', n);
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
}

const S = {};
/** Хранилище теперь раздельное: bp-mock-db:area:<id> пишется целиком, когда срез отличается от сида */
async function dbx() {
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    const r = (k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : undefined; };
    return { areas: { loyalty: r('bp-mock-db:area:loyalty'), journal: r('bp-mock-db:area:journal'), finance: r('bp-mock-db:area:finance') }, core: { bookings: r('bp-mock-db:core:bookings') } };
  });
}
const L = (db) => db.areas.loyalty ?? { memberships: [], certificates: [], cards: [], accounts: [], transactions: [], accountOperations: [] };
const extrasOf = (db, id) => db.areas.journal?.extras?.[id];
const finLines = (db, id) => (db.areas.finance?.bookingPayments ?? []).filter((p) => p.bookingId === id);

async function openBooking(b, persona = 'owner') {
  await t.go(persona, `/biz/journal?date=${b.start.slice(0, 10)}&booking=${b.id}`, 'desktop');
  const dlg = page.locator('[role="dialog"]').first();
  await dlg.waitFor({ timeout: 30000 }).catch(() => {});
  await t.settle(800);
  return dlg;
}
async function openPaySheet(b) {
  const dlg = await openBooking(b);
  const pay = dlg.getByRole('button', { name: /^Оплатить/ }).first();
  if (!(await pay.count())) throw new Error(`нет кнопки «Оплатить» в окне записи: ${flat(await dlg.innerText()).slice(0, 300)}`);
  await pay.click();
  await t.settle(1500);
  return page.getByRole('dialog', { name: /Оплата визита/ }).first();
}

try {
  const mk = (id, start, total, clientId) => ({ id, start, total, clientId });
  S.b1 = mk('bk_2461', '2026-10-01T19:15', 5000, 'cl_004');
  S.b5 = mk('bk_2565', '2026-10-01T10:00', 5000, 'cl_015');
  const mem = (db) => L(db).memberships.find((x) => x.id === 'lm_biz_nuri_1');
  const pays = (db, id) => JSON.stringify((extrasOf(db, id)?.payments ?? []).map((p) => [p.method, p.amount]));
  const fins = (db, id) => JSON.stringify(finLines(db, id).map((p) => [p.kind, p.amount, p.cancelled ? 'отменён' : '']));
  const openTab = async (b, re) => {
    const dlg = await openBooking(b);
    const tabs = dlg.locator('[role="tab"]');
    const names = (await tabs.allInnerTexts()).map((x) => x.trim());
    const i = names.findIndex((n) => re.test(n));
    if (i < 0) throw new Error('нет вкладки ' + re + ': ' + names.join(' | '));
    await tabs.nth(i).click();
    await t.settle(1800);
    return dlg;
  };
  const cancelInLoyTab = async (b) => {
    const dlg = await openTab(b, /Лояльн/);
    const btn = dlg.getByRole('button', { name: /Отменить эту оплату|Отменить всю оплату/ }).first();
    if (!(await btn.count())) throw new Error('во вкладке «Лояльность» нет отмены: ' + flat(await dlg.innerText()).slice(0, 300));
    await btn.click();
    await t.settle(800);
    const cd = page.locator('[role="alertdialog"]');
    if (await cd.count()) { await cd.last().getByRole('button').last().click(); }
    await t.settle(1800);
    return dlg;
  };

  await step('R1', 'Оплата абонементом из «Оплатить» (запись «Клиент подтвердил»)', async () => {
    const sheet = await openPaySheet(S.b1);
    await sheet.getByRole('button', { name: /Маникюр × 5/ }).first().click();
    await t.settle(2000);
    const db2 = await dbx();
    const b = (db2.core.bookings ?? []).find((x) => x.id === S.b1.id);
    t.note(`абонемент 2 → ${mem(db2)?.balanceVisits}; платежи ${pays(db2, S.b1.id)}; finance ${fins(db2, S.b1.id)}; статус ${b?.status ?? 'не менялся (client_confirmed)'}`);
    t.assert(mem(db2)?.balanceVisits === 1, 'посещение не списано');
  });

  await step('R2', 'Отмена оплаты абонементом во вкладке «Лояльность»: посещение и строка «Оплаты» вернулись', async () => {
    const dlg = await cancelInLoyTab(S.b1);
    await shot('R2-after-cancel');
    const db2 = await dbx();
    t.note(`абонемент ${mem(db2)?.balanceVisits}; платежи ${pays(db2, S.b1.id)}; finance ${fins(db2, S.b1.id)}; тосты ${(await t.toasts()).join('/')}`);
    t.assert(mem(db2)?.balanceVisits === 2, 'посещение не вернулось');
    t.assert(!(extrasOf(db2, S.b1.id)?.payments ?? []).length, 'строка журнала осталась');
    t.assert(!finLines(db2, S.b1.id).some((p) => !p.cancelled), 'строка «Оплаты» осталась');
  });

  await step('R3', 'Однократный сертификат CERT-1001: закрывает 5 000, остаток 7 000 сгорает; отмена возвращает 12 000', async () => {
    const sheet = await openPaySheet(S.b1);
    await sheet.getByRole('button', { name: /CERT-1001/ }).first().click();
    await t.settle(2000);
    await shot('R3-after-cert');
    let db2 = await dbx();
    let c = L(db2).certificates.find((x) => x.id === 'lcert_biz_nuri_1');
    t.note(`сертификат 12000 → ${c?.balance} (${c?.status}); платежи ${pays(db2, S.b1.id)}`);
    t.assert(c?.balance === 0 && c?.status === 'used', 'не погашен');
    await cancelInLoyTab(S.b1);
    db2 = await dbx();
    c = L(db2).certificates.find((x) => x.id === 'lcert_biz_nuri_1');
    t.note(`после отмены ${c?.balance} (${c?.status}), владелец ${c?.clientId}`);
    t.assert(c?.balance === 12000 && c?.status === 'active', 'не вернулся');
  });

  await step('R4', 'Бонусы из «Оплатить» (лимит 50%), затем остаток — во вкладке «Оплата» с личного счёта', async () => {
    const sheet = await openPaySheet(S.b1);
    await sheet.getByRole('button', { name: /Бонусы/ }).first().click();
    await t.settle(2000);
    let db2 = await dbx();
    const card = L(db2).cards.find((x) => x.id === 'lc_cl_004');
    const spent = 3000 - (card?.balance ?? 3000);
    t.note(`бонусы 3000 → ${card?.balance}; платежи ${pays(db2, S.b1.id)}`);
    t.assert(spent > 0 && spent <= 2500, 'бонусы не списались или больше 50%');
    const dlg = await openTab(S.b1, /^Оплата/);
    await shot('R4-finance-tab');
    t.note('«Оплата»: ' + flat(await dlg.innerText()).slice(0, 500));
    const acc = dlg.getByRole('button', { name: /Личный счёт клиента/ }).first();
    if (!(await acc.count())) throw new Error('нет «Личный счёт клиента»');
    await acc.click();
    await t.settle(1200);
    const top = page.locator('[role="dialog"]').last();
    await shot('R4-account-modal');
    t.note('окно счёта: ' + flat(await top.innerText()).slice(0, 300));
    const inp = top.locator('input').first();
    t.note('поле суммы по умолчанию: «' + (await inp.inputValue().catch(() => '?')) + '»');
    await inp.fill(String(5000 - spent));
    await t.settle(300);
    const pay = top.getByRole('button', { name: /Оплатить со счёта/ }).last();
    if (!(await pay.count())) throw new Error('нет «Оплатить со счёта»');
    await pay.click();
    await t.settle(2200);
    await shot('R4-after');
    db2 = await dbx();
    const a = L(db2).accounts.find((x) => x.clientId === 'cl_004');
    const tx = L(db2).transactions.filter((x) => x.accountId === a?.id && x.amount < 0);
    t.note(`счёт 14000 → ${a?.balance}; tx ${JSON.stringify(tx.map((x) => [x.type, x.amount, x.bookingId ?? null]))}; finance ${fins(db2, S.b1.id)}; тосты ${(await t.toasts()).join('/')}`);
    t.assert(a && a.balance === 14000 - (5000 - spent), 'со счёта списан не остаток');
    t.assert(tx.some((x) => x.bookingId === S.b1.id), 'списание со счёта не привязано к визиту');
  });

  await step('R5', 'Вкладка «Лояльность» у записи «Клиент подтвердил»: проведённая скидка переводит в «Пришёл» (правка 30.09)', async () => {
    const dlg = await openTab(S.b5, /Лояльн/);
    t.note(flat(await dlg.innerText()).slice(0, 400));
    const best = dlg.getByRole('button', { name: /Выгоднее всего/ }).first();
    if (await best.count()) { await best.click(); await t.settle(800); }
    await dlg.getByRole('button', { name: /Провести оплату/ }).first().click();
    await t.settle(2200);
    const db2 = await dbx();
    const b = (db2.core.bookings ?? []).find((x) => x.id === S.b5.id);
    t.note(`платежи ${pays(db2, S.b5.id)}; статус ${b?.status ?? '—'}`);
    t.assert(b?.status === 'arrived', 'статус не «Пришёл»');
  });

  await step('R6', 'Заявки из приложения: en, телефон — бейджи переносятся, без вылета', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3710/biz/loyalty/purchase-requests?demo=owner&lang=en', { waitUntil: 'commit', timeout: 240000 });
    await page.waitForSelector('main', { timeout: 240000 });
    await t.settle(4000);
    await shot('R6-purchase-en-phone');
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    t.note(`scrollWidth ${w}`);
    await page.goto('http://localhost:3710/biz/loyalty?lang=ru', { waitUntil: 'domcontentloaded' });
    t.assert(w <= 390, 'вылет');
  });

  await step('R7', 'Телефон: вкладка «Лояльность» в окне записи и «Оплата визита»', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://localhost:3710/biz/journal?date=2026-10-01&booking=bk_3951&demo=owner&lang=ru`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await t.settle(2500);
    const dlg = page.locator('[role="dialog"]').first();
    const tabs = dlg.locator('[role="tab"]');
    const names = (await tabs.allInnerTexts()).map((x) => x.trim());
    const i = names.findIndex((n) => /Лояльн/.test(n));
    if (i >= 0) { await tabs.nth(i).click(); await t.settle(1800); }
    await shot('R7-phone-loyalty-tab');
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    t.note(`scrollWidth ${w}; ${flat(await dlg.innerText()).slice(0, 300)}`);
  });
} catch (e) {
  log('FATAL', e.message);
  await shot('fatal');
} finally {
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
  release();
}
