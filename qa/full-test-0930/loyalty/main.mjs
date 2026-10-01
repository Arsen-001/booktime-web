// Полный тест 30.09 · loyalty: лояльность в оплате визита (журнал / финансы) + экраны раздела.
// node qa/full-test-0930/loyalty/main.mjs [--only A,B,...]
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import { makeT, today, addDays } from '/Users/arsen/WebstormProjects/booking-platform/qa/e2e/lib.mjs';

const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/loyalty';
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
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
const t = makeT(page, 'loy', {});
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` }).catch(() => {});

async function step(id, title, fn) {
  if (only && !only.includes(id[0])) return;
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
  return page.locator('[role="dialog"]').last();
}

try {
  await t.go('owner', '/biz/loyalty', 'desktop');
  // Кандидаты — из того же сида (qa/full-test-0930/loyalty/pick.mjs): завтрашние записи клиентов с лояльностью
  const mk = (id, start, total, clientId) => ({ id, start, total, clientId });
  S.b1 = mk('bk_3964', '2026-10-01T16:45', 5000, 'cl_002'); // абонемент «Маникюр × 5», CERT-1001, карта 2000, счёт 10000
  S.b2 = mk('bk_2568', '2026-10-01T13:00', 12000, 'cl_003'); // CERT-1002, счёт 12000
  S.b3 = mk('bk_3951', '2026-10-01T11:30', 6000, 'cl_019'); // карта 3000 + акция
  S.b4 = mk('bk_2566', '2026-10-01T13:00', 6000, 'cl_077'); // карта 5000
  S.b5 = mk('bk_2565', '2026-10-01T10:00', 5000, 'cl_015');
  const probe = await openBooking(S.b1);
  const ptxt = flat(await probe.innerText()).slice(0, 300);
  log('окно bk_3964:', ptxt);
  if (!/5\s?000/.test(ptxt)) log('!! окно записи bk_3964 не похоже на ожидаемое (сид мог разойтись)');
  // ─────────── A. «Оплатить» в окне записи (журнал) ───────────
  const cancelFirstLine = async (sheet) => {
    const cancel = sheet.getByRole('button', { name: /Отменить/ }).first();
    if (!(await cancel.count())) throw new Error('нет кнопки отмены платежа: ' + flat(await sheet.innerText()).slice(0, 300));
    await cancel.click();
    await t.settle(800);
    const cd = page.locator('[role="alertdialog"]');
    if (await cd.count()) { await cd.last().getByRole('button').last().click(); await t.settle(1500); }
  };
  const mem = (db) => L(db).memberships.find((x) => x.id === 'lm_biz_nuri_1');
  const pays = (db, id) => JSON.stringify((extrasOf(db, id)?.payments ?? []).map((p) => [p.method, p.amount]));
  const fins = (db, id) => JSON.stringify(finLines(db, id).map((p) => [p.kind, p.amount, p.cancelled ? 'отменён' : '']));

  await step('A1', 'Окно «Оплата визита» показывает лояльность клиента (абонемент, сертификат, бонусы, счёт)', async () => {
    const sheet = await openPaySheet(S.b1);
    await shot('A1-pay-sheet');
    const txt = flat(await sheet.innerText());
    t.note(txt.slice(0, 700));
    t.assert(/Маникюр × 5/.test(txt), 'нет плитки абонемента');
    t.assert(/CERT-1001/.test(txt), 'нет плитки сертификата');
    t.assert(/Бонусы/.test(txt), 'нет плитки бонусов');
    t.assert(/Личный счёт/.test(txt), 'нет плитки личного счёта');
  });

  await step('A2', 'Оплата абонементом: −1 посещение, строка платежа, зеркало во вкладке «Оплата», статус «Пришёл»', async () => {
    const sheet = page.locator('[role="dialog"]').last();
    await sheet.getByRole('button', { name: /Маникюр × 5/ }).first().click();
    await t.settle(2000);
    await shot('A2-after-membership');
    const db2 = await dbx();
    const m = mem(db2);
    const b = (db2.core.bookings ?? []).find((x) => x.id === S.b1.id);
    t.note(`абонемент 2 → ${m?.balanceVisits}; платежи ${pays(db2, S.b1.id)}; finance ${fins(db2, S.b1.id)}; статус ${b?.status}; тосты ${(await t.toasts()).join('/')}`);
    t.note('окно: ' + flat(await sheet.innerText()).slice(0, 300));
    t.assert(m?.balanceVisits === 1, 'посещение не списано');
    t.assert((extrasOf(db2, S.b1.id)?.payments ?? []).some((p) => p.method === 'membership' && p.amount === 5000), 'нет строки абонемента на всю сумму');
    t.assert(finLines(db2, S.b1.id).some((p) => !p.cancelled && p.amount === 5000), 'во вкладке «Оплата» нет зеркальной строки');
    t.assert(b?.status === 'arrived', `статус не «Пришёл» (F-06-069): ${b?.status}`);
  });

  await step('A3', 'Окно записи после оплаты абонементом: «оплачено», во вкладке «Оплата» долга нет', async () => {
    const dlg = await openBooking(S.b1);
    const txt = flat(await dlg.innerText());
    await shot('A3-window-after');
    t.note(txt.slice(0, 400));
    const tabs = dlg.locator('[role="tab"]');
    const names = (await tabs.allInnerTexts()).map((x) => x.trim());
    t.note('вкладки: ' + names.join(' | '));
    const pi = names.findIndex((n) => /^Оплата/.test(n));
    if (pi >= 0) {
      await tabs.nth(pi).click();
      await t.settle(1500);
      await shot('A3-finance-tab');
      t.note('«Оплата»: ' + flat(await dlg.innerText()).slice(0, 500));
    }
    t.assert(!/Посещение не оплачено/.test(txt), 'окно записи: «не оплачено»');
  });

  await step('A4', 'Отмена строки абонемента: посещение вернулось, строки в журнале и «Оплате» сняты', async () => {
    const sheet = await openPaySheet(S.b1);
    await shot('A4-sheet-paid');
    t.note(flat(await sheet.innerText()).slice(0, 300));
    await cancelFirstLine(sheet);
    const db2 = await dbx();
    t.note(`абонемент ${mem(db2)?.balanceVisits}; платежи ${pays(db2, S.b1.id)}; finance ${fins(db2, S.b1.id)}`);
    t.assert(mem(db2)?.balanceVisits === 2, 'посещение не вернулось');
    t.assert(!(extrasOf(db2, S.b1.id)?.payments ?? []).length, 'строка в журнале осталась');
    t.assert(!finLines(db2, S.b1.id).some((p) => !p.cancelled), 'строка в «Оплате» осталась');
  });

  await step('A5', 'Однократный сертификат CERT-1001 (12 000): закрывает 5 000, подсказка о сгорании 7 000, остаток сгорает', async () => {
    const sheet = await openPaySheet(S.b1);
    const tile = sheet.getByRole('button', { name: /CERT-1001/ }).first();
    t.note('плитка: ' + flat(await tile.innerText()));
    await tile.click();
    await t.settle(2000);
    await shot('A5-after-cert');
    const db2 = await dbx();
    const c = L(db2).certificates.find((x) => x.id === 'lcert_biz_nuri_1');
    t.note(`сертификат 12000 → ${c?.balance} (${c?.status}); платежи ${pays(db2, S.b1.id)}`);
    t.assert(c?.balance === 0 && c?.status === 'used', 'однократный не погашен');
  });

  await step('A6', 'Отмена сертификата вернула 12 000; бонусы — не больше лимита 50%', async () => {
    let sheet = await openPaySheet(S.b1);
    await cancelFirstLine(sheet);
    const db1 = await dbx();
    const c = L(db1).certificates.find((x) => x.id === 'lcert_biz_nuri_1');
    t.note(`сертификат после отмены ${c?.balance} (${c?.status})`);
    t.assert(c?.balance === 12000, 'сертификат не вернулся');
    sheet = await openPaySheet(S.b1);
    await sheet.getByRole('button', { name: /Бонусы/ }).first().click();
    await t.settle(2000);
    await shot('A6-after-bonus');
    const db2 = await dbx();
    const card = L(db2).cards.find((x) => x.id === 'lc_cl_002');
    t.note(`бонусы 2000 → ${card?.balance}; платежи ${pays(db2, S.b1.id)}; тосты ${(await t.toasts()).join('/')}`);
    t.assert(card && card.balance < 2000, 'бонусы не списались');
    t.assert(2000 - card.balance <= 2500, 'больше 50%');
  });

  await step('A7', 'Остаток 3 000 — во вкладке «Оплата» (finance) с личного счёта: счёт лояльности списан, визит оплачен', async () => {
    const dlg = await openBooking(S.b1);
    const tabs = dlg.locator('[role="tab"]');
    const names = (await tabs.allInnerTexts()).map((x) => x.trim());
    const pi = names.findIndex((n) => /^Оплата/.test(n));
    if (pi < 0) throw new Error('нет вкладки «Оплата»: ' + names.join('|'));
    await tabs.nth(pi).click();
    await t.settle(1500);
    await shot('A7-finance-tab');
    t.note('«Оплата»: ' + flat(await dlg.innerText()).slice(0, 600));
    const btns = (await dlg.locator('button').allInnerTexts()).map((x) => x.trim()).filter(Boolean);
    t.note('кнопки: ' + btns.slice(0, 40).join(' | '));
    const acc = dlg.getByRole('button', { name: /Личный сч|счёт клиента|Со счёта/ }).first();
    if (!(await acc.count())) throw new Error('во вкладке «Оплата» нет способа «Личный счёт»');
    await acc.click();
    await t.settle(1200);
    await shot('A7-account-picked');
    const top = page.locator('[role="dialog"]').last();
    t.note('после выбора: ' + flat(await top.innerText()).slice(0, 300));
    const payBtn = top.getByRole('button', { name: /^(Оплатить|Принять|Провести|Списать)/ }).last();
    if (await payBtn.count()) { await payBtn.click(); await t.settle(2000); }
    await shot('A7-after');
    const db2 = await dbx();
    const a = L(db2).accounts.find((x) => x.id === 'lacc_biz_nuri_1');
    const tx = L(db2).transactions.filter((x) => x.accountId === 'lacc_biz_nuri_1' && x.amount < 0);
    t.note(`счёт 10000 → ${a?.balance}; tx ${JSON.stringify(tx.map((x) => [x.type, x.amount, x.bookingId ?? null]))}; finance ${fins(db2, S.b1.id)}; тосты ${(await t.toasts()).join('/')}`);
    t.assert(a && a.balance === 7000, 'со счёта списано не 3 000');
    t.assert(tx.some((x) => x.bookingId === S.b1.id), 'списание со счёта не привязано к визиту (bookingId пуст)');
  });

  await step('A8', 'Оплата с личного счёта в окне «Оплата визита» (12 000 со счёта 12 000)', async () => {
    const sheet = await openPaySheet(S.b2);
    t.note(flat(await sheet.innerText()).slice(0, 400));
    await sheet.getByRole('button', { name: /Личный счёт/ }).first().click();
    await t.settle(2000);
    await shot('A8-after-account');
    const db2 = await dbx();
    const a = L(db2).accounts.find((x) => x.id === 'lacc_biz_nuri_2');
    t.note(`счёт 12000 → ${a?.balance}; платежи ${pays(db2, S.b2.id)}; finance ${fins(db2, S.b2.id)}`);
    t.assert(a?.balance === 0, 'со счёта списано не 12 000');
  });

  // ─────────── B. Вкладка «Лояльность» окна записи ───────────
  const openLoyTab = async (b) => {
    const dlg = await openBooking(b);
    const tabs = dlg.locator('[role="tab"]');
    const names = (await tabs.allInnerTexts()).map((x) => x.trim());
    const li = names.findIndex((n) => /Лояльн/.test(n));
    if (li < 0) throw new Error('нет вкладки «Лояльность»: ' + names.join(' | '));
    await tabs.nth(li).click();
    await t.settle(1800);
    return dlg;
  };
  await step('B1', 'Вкладка «Лояльность»: скидка 10% по карте «Постоянный гость» предлагается и проводится', async () => {
    const dlg = await openLoyTab(S.b3);
    await shot('B1-loyalty-tab');
    t.note(flat(await dlg.innerText()).slice(0, 800));
    const best = dlg.getByRole('button', { name: /Выгоднее всего/ }).first();
    if (await best.count()) { await best.click(); await t.settle(800); }
    await shot('B1-picked');
    const commit = dlg.getByRole('button', { name: /Провести оплату/ }).first();
    if (!(await commit.count())) throw new Error('нет кнопки «Провести оплату»');
    await commit.click();
    await t.settle(2000);
    await shot('B1-after-commit');
    const db2 = await dbx();
    const tx = L(db2).transactions.filter((x) => x.bookingId === S.b3.id);
    t.note(`tx ${JSON.stringify(tx.map((x) => [x.type, x.amount]))}; платежи ${pays(db2, S.b3.id)}; finance ${fins(db2, S.b3.id)}; тосты ${(await t.toasts()).join('/')}`);
    t.assert(tx.some((x) => x.type === 'promoDiscount' && x.amount === -600), 'нет скидки −600');
    t.assert(finLines(db2, S.b3.id).some((p) => p.kind === 'discount' && !p.cancelled && p.amount === 600), 'скидка не попала во вкладку «Оплата»');
  });

  await step('B2', 'После скидки «К оплате» во вкладке «Оплата» = 6 000 − 600', async () => {
    const dlg = await openBooking(S.b3);
    const tabs = dlg.locator('[role="tab"]');
    const names = (await tabs.allInnerTexts()).map((x) => x.trim());
    const pi = names.findIndex((n) => /^Оплата/.test(n));
    if (pi < 0) throw new Error('нет вкладки «Оплата»');
    await tabs.nth(pi).click();
    await t.settle(1500);
    await shot('B2-finance-tab');
    const ft = flat(await dlg.innerText());
    t.note(ft.slice(0, 600));
    t.assert(/5\s?400/.test(ft), 'нигде нет 5 400');
  });

  await step('B3', 'Вкладка «Лояльность»: «Списать бонусы» (карта 5 000, визит 6 000 → не больше 3 000)', async () => {
    const dlg = await openLoyTab(S.b4);
    await shot('B3-loyalty-tab');
    t.note(flat(await dlg.innerText()).slice(0, 600));
    const charge = dlg.getByRole('button', { name: /Списать бонусы/ }).first();
    if (!(await charge.count())) throw new Error('нет «Списать бонусы»');
    await charge.click();
    await t.settle(800);
    await dlg.getByRole('button', { name: /Провести оплату/ }).first().click();
    await t.settle(2000);
    await shot('B3-after');
    const db2 = await dbx();
    const card = L(db2).cards.find((x) => x.id === 'lc_cl_077');
    t.note(`карта 5000 → ${card?.balance}; платежи ${pays(db2, S.b4.id)}; finance ${fins(db2, S.b4.id)}`);
    t.assert(card && 5000 - card.balance === 3000, 'списано не 3 000');
  });

  await step('B4', 'Транзакции/стоимость: «Оплачено бонусами» на главной лояльности выросло', async () => {
    await t.go('owner', '/biz/loyalty', 'desktop');
    const txt = flat(await t.mainText());
    const m = txt.match(/Оплачено бонусами · ([\d\s  ]+)/);
    t.note(`Оплачено бонусами: ${m?.[1] ?? '—'}`);
    await shot('B4-hub');
    t.assert(m && Number(m[1].replace(/\D/g, '')) >= 5000, 'на главной лояльности не видно оплаты бонусами');
  });

  // ─────────── D. Транзакции ───────────
  await step('D1', 'Транзакции лояльности показывают проведённые оплаты', async () => {
    await t.go('owner', '/biz/loyalty/transactions', 'desktop');
    await shot('D1-transactions');
    const txt = flat(await t.mainText());
    t.note(txt.slice(0, 600));
    t.assert(/Маникюр × 5|Скидка постоянному|Списание бонусов|бонус/i.test(txt), 'наши операции не видны в транзакциях');
  });

  // ─────────── E. Экраны продажи (разведка + действие) ───────────
  for (const [id, r] of [['E1', '/biz/loyalty/memberships'], ['E2', '/biz/loyalty/certificates'], ['E3', '/biz/loyalty/deposits'], ['E4', '/biz/loyalty/cards'], ['E5', '/biz/loyalty/promotions'], ['E6', '/biz/loyalty/card-types']]) {
    await step(id, `Экран ${r}: главное действие открывает форму`, async () => {
      await t.go('owner', r, 'desktop');
      await shot(`${id}-list`);
      t.note(flat(await t.mainText()).slice(0, 300));
      const btns = (await page.locator('main button').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
      t.note('кнопки: ' + btns.slice(0, 20).join(' | '));
      const primary = page.locator('main button', { hasText: /^(Продать|Добавить|Создать|Выдать|Открыть счёт|Новая|Новый)/ }).first();
      if (!(await primary.count())) throw new Error('нет главной кнопки');
      await primary.click();
      await t.settle(1200);
      await shot(`${id}-form`);
      const top = page.locator('[role="dialog"]').last();
      t.note('форма: ' + (await top.count() ? flat(await top.innerText()).slice(0, 500) : `адрес ${page.url()} ${flat(await t.mainText()).slice(0, 300)}`));
    });
  }

  // ─────────── F. Пустой бизнес, ошибка, роли ───────────
  await step('F1', 'Пустой бизнес: разделы лояльности — EmptyState', async () => {
    for (const r of ['/biz/loyalty/cards', '/biz/loyalty/memberships', '/biz/loyalty/certificates', '/biz/loyalty/transactions', '/biz/loyalty/deposits', '/biz/loyalty/promotions']) {
      await t.go('owner', `${r}?empty=1`, 'phone');
      await shot(`F1-empty${r.replaceAll('/', '_')}`);
      const has = await page.locator('[data-empty-state], [data-empty]').count();
      t.note(`${r}: ${flat(await t.mainText()).slice(0, 160)} (emptyState=${has})`);
    }
    await t.go('owner', '/biz/loyalty?empty=0', 'phone');
  });
  await step('F2', 'Ошибка сервера: ErrorState с «Повторить»', async () => {
    await t.go('owner', '/biz/loyalty/memberships?api=error', 'phone');
    await t.settle(2500);
    await shot('F2-error');
    const txt = flat(await t.mainText());
    t.note(txt.slice(0, 200));
    await t.go('owner', '/biz/loyalty?api=normal', 'phone');
    t.assert(/Повторить|Try again/.test(txt), 'нет «Повторить»');
  });
  await step('F3', 'Роли: админ и мастер в /biz/loyalty', async () => {
    for (const p of ['admin', 'master']) {
      await t.go(p, '/biz/loyalty', 'phone');
      await shot(`F3-${p}`);
      t.note(`${p}: ${flat(await t.mainText()).slice(0, 200)}`);
    }
  });
  await step('F4', 'Заявки из приложения, en, телефон: без вылета по ширине', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3710/biz/loyalty/purchase-requests?demo=owner&lang=en', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await t.settle(2000);
    await shot('F4-purchase-en-phone');
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    t.note(`scrollWidth ${w}`);
    await page.goto('http://localhost:3710/biz/loyalty?lang=ru', { waitUntil: 'domcontentloaded' });
    t.assert(w <= 390, 'вылет по ширине');
  });
} catch (e) {
  log('FATAL', e.message);
  await shot('fatal');
} finally {
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
  await browser.close();
  release();
}
