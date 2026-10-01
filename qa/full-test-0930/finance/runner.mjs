// Финансы — сценарии действием в ОДНОМ браузере (ограничитель слотов). Каждый сценарий — свой контекст (свежая мок-база).
//   node qa/full-test-0930/finance/runner.mjs [prepaid,ops]
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/finance';
const B = 'http://localhost:3710';
const only = (process.argv[2] || 'prepaid,ops').split(',');
const log = (...a) => console.log(...a);
const flat = (s) => String(s).replace(/\s*\n\s*/g, ' | ').slice(0, 900);
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); log(ok ? 'PASS' : 'FAIL', name, info); };

const release = await acquireBrowserSlot({ timeoutMs: 120 * 60_000 });
const browser = await chromium.launch({ headless: true });

async function ctxPage(w = 390) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 800 ? 900 : 844 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  page.on('pageerror', (e) => log('  PAGEERROR', e.message.slice(0, 200)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text()) && log('  CONSOLE', m.text().slice(0, 200)));
  return { ctx, page };
}
const go = async (page, path) => { await page.goto(`${B}${path}`, { waitUntil: 'networkidle', timeout: 180_000 }); await page.waitForTimeout(1500); };

// Доступ к мок-базе в localStorage (формат ключей — src/mock/db.ts)
const readBookings = (page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('bp-mock-db:core:bookings') || 'null');
  const list = Array.isArray(raw) ? raw : raw?.state ?? raw?.data ?? raw?.items ?? [];
  return Array.isArray(list) ? list : [];
});
const readFinance = (page) => page.evaluate(() => { const r = JSON.parse(localStorage.getItem('bp-mock-db:area:finance') || 'null'); return r?.state ?? r; });

async function openPayTab(page, bookingId, date) {
  await go(page, `/biz/journal?date=${date}&booking=${bookingId}`);
  const tab = page.getByRole('tab', { name: /^Оплата/ }).first();
  if (await tab.count()) await tab.click();
  else await page.getByText(/^Оплата$/).first().click();
  await page.locator('[data-f~="F-07-045"]').first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
}

const scenarios = {
  // ⭐ F-00-097: окно просит остаток; «Наличные» проводит остаток, а не всю сумму; строка «Предоплата» в сводке
  async prepaid() {
    // Запись из детерминированного сида (qa/full-test-0930/finance/pick.mjs): Atam Dental, сегодня, «пришёл»
    const b = { id: process.env.PP_ID || 'bk_2430', start: process.env.PP_START || new Date().toISOString().slice(0, 10) + 'T16:30', total: Number(process.env.PP_TOTAL || 141000), prepayment: { amount: Number(process.env.PP_PRE || 42000) } };
    const { ctx, page } = await ctxPage();
    await go(page, '/biz/journal?demo=owner&sphere=dental&lang=ru&empty=0');
    await openPayTab(page, b.id, b.start.slice(0, 10));
    await page.screenshot({ path: `${OUT}/prepaid-01-pay-phone.png`, fullPage: true });
    const summary = flat(await page.locator('[data-f~="F-07-045"]').first().innerText());
    log('  SUMMARY', summary);
    const remainder = b.total - b.prepayment.amount;
    const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n).replace(/\u00a0|\u202f/g, ' ');
    const norm = (s) => s.replace(/\u00a0|\u202f/g, ' ');
    check('prepaid: «К оплате» = остаток', norm(summary).includes(fmt(remainder)), `ждали ${fmt(remainder)}`);
    check('prepaid: строка «Предоплата» в сводке', /Предоплата/.test(summary) && norm(summary).includes(fmt(b.prepayment.amount)));
    const cash = page.getByRole('button', { name: /Наличные/ }).first();
    const cashText = flat(await cash.innerText());
    check('prepaid: плитка «Наличные» показывает остаток', norm(cashText).includes(fmt(remainder)), cashText);
    await cash.click();
    const dlg = page.getByRole('dialog').last();
    await dlg.waitFor();
    await page.waitForTimeout(500);
    const dlgText = flat(await dlg.innerText());
    log('  CONFIRM', dlgText);
    await page.screenshot({ path: `${OUT}/prepaid-02-confirm-phone.png` });
    const btns = await dlg.getByRole('button').allInnerTexts();
    log('  dialog buttons', JSON.stringify(btns));
    await dlg.getByRole('button').last().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/prepaid-03-after-phone.png`, fullPage: true });
    const after = flat(await page.locator('[data-f~="F-07-045"]').first().innerText());
    log('  AFTER', after);
    check('prepaid: после оплаты статус «Оплачено»', /Оплачено/.test(after));
    check('prepaid: повторной оплаты нет', (await page.getByRole('button', { name: /Наличные/ }).count()) === 0);
    // Полный возврат: вернуть можно только полученное в кассу (остаток), предоплата у мастера — её возвращает «Вернул» в журнале
    const rf = page.getByRole('button', { name: 'Полный возврат' }).first();
    if (await rf.count()) {
      await rf.click();
      const rd = page.getByRole('dialog').last();
      await rd.waitFor();
      await page.waitForTimeout(400);
      const rdText = flat(await rd.innerText());
      log('  REFUND', rdText);
      await page.screenshot({ path: `${OUT}/prepaid-05-refund-phone.png` });
      check('refund: полный возврат предлагает вернуть остаток (не всю сумму с предоплатой)', norm(rdText).includes(fmt(remainder)) && !norm(rdText).includes(fmt(b.total)), rdText.slice(0, 200));
      await rd.locator('input').last().fill('QA возврат');
      await rd.getByRole('button', { name: /^Вернуть/ }).last().click();
      await page.waitForTimeout(2500);
      const afterRefund = flat(await page.locator('[data-f~="F-07-045"]').first().innerText());
      log('  AFTER REFUND', afterRefund);
      await page.screenshot({ path: `${OUT}/prepaid-06-refunded-phone.png`, fullPage: true });
      check('refund: статус «Возвращено», строка «Возвращено» = остаток', /Возвращено/.test(afterRefund) && norm(afterRefund).includes(fmt(remainder)), afterRefund);
    } else check('refund: кнопка «Полный возврат» после оплаты', false);
    // Касса: операция по визиту — на остаток, не на всю сумму
    await go(page, '/biz/finance');
    await page.screenshot({ path: `${OUT}/prepaid-04-ops-phone.png`, fullPage: true });
    const ops = norm(await page.locator('main').innerText());
    check('prepaid: в операциях приход на остаток ' + fmt(remainder), ops.includes(fmt(remainder)), '');
    check('prepaid: в операциях НЕТ прихода на всю сумму ' + fmt(b.total), !ops.includes(fmt(b.total)), '');
    // F-07-014: операцию оплаты визита не отменяют со страницы операции — там подсказка и ссылка на визит
    const bhref = await page.evaluate((ESC) => {
      for (const a of document.querySelectorAll('a[href*="/biz/finance/operations/"]')) {
        const row = a.closest('tr, li, [role="row"], article, div.rounded-xl');
        if (row && new RegExp(ESC).test(row.textContent.replace(/\u00a0|\u202f/g, ' ')) && /Оказание|услуг/i.test(row.textContent)) return a.getAttribute('href');
      }
      return null;
    }, fmt(remainder));
    log('  booking op href', bhref);
    if (bhref) {
      await go(page, bhref);
      await page.screenshot({ path: `${OUT}/ops-booking-detail-phone.png`, fullPage: true });
      const d = flat(await page.locator('main').innerText());
      log('  BOOKING OP', d.slice(0, 400));
      check('F-07-014: у оплаты визита нет «Отменить»/«Изменить», есть подсказка «окно визита»', (await page.getByRole('button', { name: /^Отменить операцию$|^Отменить$|^Изменить$/ }).count()) === 0 && /окне визита/.test(d));
    } else check('F-07-014: нашли операцию оплаты визита', false);
    await ctx.close();
  },

  // Полностью предоплаченный визит «пришёл»: окно — «Оплачено», нет в «Пришли, но не оплатили»; частично — остаток
  async prepaidFull() {
    const { ctx, page } = await ctxPage(1440);
    await go(page, '/biz/finance?demo=owner&lang=ru&empty=0');
    const countOf = async () => { const t = await page.locator('[data-f~="F-07-057"]').first().innerText().catch(() => ''); const m = t.match(/(\d+) визит/); return m ? Number(m[1]) : 0; };
    const before = await countOf();
    const target = await page.evaluate(() => {
      const key = 'bp-mock-db:core:bookings';
      const raw = JSON.parse(localStorage.getItem(key));
      const list = Array.isArray(raw) ? raw : raw.state ?? raw.data ?? raw.items;
      const fin = JSON.parse(localStorage.getItem('bp-mock-db:area:finance'));
      const pays = (fin.state ?? fin).bookingPayments;
      const now = new Date();
      const y = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
      const b = list.find((x) => x.status === 'arrived' && !x.deletedAt && x.start.slice(0, 10) === y && !pays.some((p) => p.bookingId === x.id) && x.total > 0 && !(x.goods?.length));
      if (!b) return null;
      b.prepayment = { amount: b.total, paid: true, full: true };
      localStorage.setItem(key, JSON.stringify(raw));
      return { id: b.id, start: b.start, total: b.total };
    });
    if (!target) return check('prepaidFull: вчерашний неоплаченный визит «пришёл»', false);
    log('  target', JSON.stringify(target));
    await go(page, '/biz/finance');
    const unpaid = page.locator('[data-f~="F-07-057"], [data-f*="unpaid"]');
    const body = flat(await page.locator('main').innerText());
    await page.screenshot({ path: `${OUT}/prepaidFull-01-ops-desktop.png`, fullPage: true });
    const bookingHref = await page.locator(`a[href*="${target.id}"]`).count();
    const afterCount = await countOf();
    check('prepaidFull: счётчик «пришли, но не оплачены» уменьшился на 1', afterCount === before - 1, `было ${before}, стало ${afterCount}`);
    check('prepaidFull: визит, оплаченный предоплатой целиком, не в «Пришли, но не оплатили»', bookingHref === 0, `ссылок на визит: ${bookingHref}; ${/не оплачен/.test(body) ? 'карточка неоплаченных есть' : 'карточки нет'}`);
    await openPayTab(page, target.id, target.start.slice(0, 10));
    const s = flat(await page.locator('[data-f~="F-07-045"]').first().innerText());
    log('  SUMMARY', s);
    await page.screenshot({ path: `${OUT}/prepaidFull-02-window-desktop.png` });
    check('prepaidFull: окно — «Оплачено», строка «Предоплата — вся сумма»', /Оплачено/.test(s) && /Предоплата/.test(s), s);
    check('prepaidFull: плиток оплаты нет', (await page.getByRole('button', { name: /Наличные/ }).count()) === 0);
    await ctx.close();
  },

  // Кассовая смена: открытие показывает «по учёту», приход в смене, закрытие с недостачей, Z-отчёт; операция задним числом
  async shift() {
    for (const w of [390, 1440]) {
      const { ctx, page } = await ctxPage(w);
      await go(page, '/biz/finance/accounts?demo=owner&lang=ru&empty=0');
      const card = page.locator('[data-f~="F-07-001"]').filter({ has: page.getByRole('button', { name: /^(Открыть|Закрыть) смену$/ }) }).first();
      await card.waitFor();
      const cardText0 = flat(await card.innerText());
      log('  CARD0', cardText0.slice(0, 200));
      await card.getByRole('button', { name: 'Открыть смену' }).click();
      const dlg = page.getByRole('dialog');
      await dlg.waitFor();
      await dlg.locator('input').first().fill('10000');
      await page.waitForTimeout(400);
      const openText = flat(await dlg.innerText());
      log('  OPEN', openText);
      await page.screenshot({ path: `${OUT}/shift-01-open-${w}.png` });
      check(`shift@${w}: окно открытия показывает «По учёту должно быть» и расхождение`, /По учёту должно быть/.test(openText) && /(Излишек|Недостача|Сходится)/.test(openText));
      await dlg.getByRole('button', { name: 'Открыть смену' }).click();
      await page.waitForTimeout(2000);
      const opened = flat(await card.innerText());
      check(`shift@${w}: смена открыта`, /Смена открыта/.test(opened), opened.slice(0, 120));
      // В ящике после открытия ровно 10 000 (поправка на расхождение)
      const bal = flat(await page.locator('main').innerText());
      // Операция задним числом в наличную кассу — через «Новый платёж»
      await go(page, '/biz/finance');
      await page.getByRole('button', { name: /Новый платёж/ }).first().click();
      const sheet = page.getByRole('dialog').last();
      await sheet.waitFor();
      await page.waitForTimeout(600);
      // Приход, статья — первая, сумма 3000, дата — вчера
      await sheet.getByRole('radio', { name: /Приход|Доход/ }).first().click().catch(() => {});
      const selects = sheet.getByRole('combobox');
      await selects.first().click();
      await page.getByRole('option').first().click();
      await sheet.locator('input[inputmode="numeric"], input[inputmode="decimal"]').first().fill('3000');
      const y = new Date(Date.now() - 86400000);
      const dateInput = sheet.locator('input[type="date"]').first();
      const hasDate = await dateInput.count();
      if (hasDate) await dateInput.fill(y.toISOString().slice(0, 10));
      await page.screenshot({ path: `${OUT}/shift-02-newop-${w}.png` });
      await sheet.getByRole('button', { name: /Сохранить|Создать|Провести/ }).last().click();
      await page.waitForTimeout(2000);
      log('  newop backdated:', hasDate ? 'yes' : 'no date input');
      await go(page, '/biz/finance/accounts');
      await card.getByRole('button', { name: 'Закрыть смену' }).click();
      await dlg.waitFor();
      await dlg.locator('input').first().fill('12500');
      await page.waitForTimeout(400);
      const closeText = flat(await dlg.innerText());
      log('  CLOSE', closeText);
      await page.screenshot({ path: `${OUT}/shift-03-close-${w}.png` });
      await dlg.getByRole('button', { name: 'Закрыть смену' }).click();
      await page.waitForTimeout(2500);
      const z = flat(await page.getByRole('dialog').innerText());
      log('  Z', z);
      await page.screenshot({ path: `${OUT}/shift-04-z-${w}.png` });
      const m = closeText.replace(/ | /g, ' ').match(/По учёту должно быть \| ([\d ]+)/);
      const zm = z.replace(/ | /g, ' ').match(/Должно быть в ящике \| ([\d ]+)/);
      check(`shift@${w}: Z «Должно быть в ящике» = «По учёту» при закрытии`, m && zm && m[1].trim() === zm[1].trim(), `закрытие ${m?.[1]} / Z ${zm?.[1]}`);
      check(`shift@${w}: Z показывает недостачу 500`, /Недостача \| 500/.test(z.replace(/ | /g, ' ')), '');
      await ctx.close();
    }
  },

  // Операции: создать ручную, найти в списке, отменить, «Отменённые»
  async ops() {
    const { ctx, page } = await ctxPage(1440);
    await go(page, '/biz/finance?demo=owner&lang=ru&empty=0');
    await page.screenshot({ path: `${OUT}/ops-01-list-desktop.png` });
    await page.getByRole('button', { name: /Новый платёж/ }).first().click();
    const sheet = page.getByRole('dialog').last();
    await sheet.waitFor();
    await page.waitForTimeout(600);
    // пустое — ошибки
    await sheet.getByRole('button', { name: /Сохранить|Создать|Провести/ }).last().click();
    await page.waitForTimeout(500);
    const errs = flat(await sheet.innerText());
    check('ops: пустая форма — ошибки «Укажите сумму»', /Укажите сумму|Выберите статью/.test(errs));
    await sheet.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();
    await sheet.locator('input[inputmode="numeric"], input[inputmode="decimal"]').first().fill('4321');
    await sheet.locator('textarea').last().fill('QA тест 4321');
    await sheet.getByRole('button', { name: /Сохранить|Создать|Провести/ }).last().click();
    await page.waitForTimeout(2500);
    const txt = await page.locator('main').innerText();
    check('ops: новая операция видна в списке', /4\s?321/.test(txt.replace(/ | /g, ' ')));
    await page.screenshot({ path: `${OUT}/ops-02-created-desktop.png` });
    const href = await page.evaluate(() => {
      for (const a of document.querySelectorAll('a[href*="/biz/finance/operations/"]')) {
        const row = a.closest('tr, li, [role="row"], article, div.rounded-xl');
        if (row && /4\s?321/.test(row.textContent.replace(/\u00a0|\u202f/g, ' '))) return a.getAttribute('href');
      }
      return null;
    });
    log('  op href', href);
    if (href) await go(page, href);
    await page.waitForTimeout(2500);
    log('  url after click', page.url());
    await page.screenshot({ path: `${OUT}/ops-03-detail-desktop.png` });
    const cancelBtn = page.getByRole('button', { name: /Отменить операцию|Отменить/ }).first();
    if (await cancelBtn.count()) {
      await cancelBtn.click();
      await page.waitForTimeout(700);
      const c = page.getByRole('alertdialog').or(page.getByRole('dialog')).last();
      const ta = c.locator('textarea, input[type="text"]');
      if (await ta.count()) await ta.first().fill('QA отмена');
      await c.getByRole('button', { name: /Отменить|Да/ }).last().click();
      await page.waitForTimeout(2000);
      const d = flat(await page.locator('main').innerText());
      check('ops: операция отменена (статус «Отменена»)', /Отменена/.test(d), d.slice(0, 200));
      await page.screenshot({ path: `${OUT}/ops-04-cancelled-desktop.png` });
    } else check('ops: кнопка отмены на странице операции', false, page.url());
    await ctx.close();
  },

  // Права: мастер не видит финансы, администратор — по галочкам
  async roles() {
    for (const persona of ['admin', 'master', 'individual']) {
      const { ctx, page } = await ctxPage(390);
      await go(page, `/biz/finance?demo=${persona}&lang=ru&empty=0`);
      const t = flat(await page.locator('body').innerText());
      await page.screenshot({ path: `${OUT}/roles-${persona}-phone.png` });
      log(`  ${persona}:`, t.slice(0, 300));
      if (persona === 'master') check('roles: мастер салона не видит операции бизнеса', !/Новый платёж/.test(t), t.slice(0, 160));
      else check(`roles: ${persona} открывает операции`, /Финансовые операции|Операции/.test(t), t.slice(0, 160));
      await ctx.close();
    }
  },

  // Состояния: ошибка, пустой бизнес, en
  async states() {
    const cases = [
      ['/biz/finance?demo=owner&lang=ru&api=error&empty=0', 'error'],
      ['/biz/finance/accounts?demo=owner&lang=ru&api=0&empty=1', 'empty-accounts'],
      ['/biz/finance?demo=owner&lang=ru&empty=1', 'empty-ops'],
      ['/biz/finance/accounts?demo=owner&lang=en&empty=0', 'en-accounts'],
      ['/biz/finance/accounts?demo=owner&lang=hy&empty=0', 'hy-accounts'],
    ];
    for (const [path, name] of cases) {
      const { ctx, page } = await ctxPage(390);
      await go(page, path);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/state-${name}-phone.png`, fullPage: true });
      log(`  ${name}:`, flat(await page.locator('main').innerText().catch(() => '')).slice(0, 300));
      await ctx.close();
    }
  },
};

try {
  for (const n of only) {
    log('=== ', n);
    try { await scenarios[n](); } catch (e) { check(`${n}: сценарий упал`, false, e.message.split('\n')[0]); }
  }
} finally {
  await browser.close();
  release();
  log('\nИТОГ', results.filter((r) => r.ok).length, '/', results.length);
  for (const r of results.filter((x) => !x.ok)) log('  FAIL', r.name, r.info);
}
