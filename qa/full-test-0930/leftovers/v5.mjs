// Последний заход: всё, что раньше проверялось только сборкой. Каждый раздел — в свежем контексте = свежий сид
// (то же, что «Сбросить демо-данные»: база браузера пустая, сид строится заново).
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/leftovers';
const only = process.argv[2]?.split(',');
const want = (k) => !only || only.includes(k);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
async function fresh(opts = DESK) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('  pageerror', e.message.slice(0, 160)));
  page.on('dialog', (d) => d.accept());
  return { ctx, page };
}
const go = async (page, path, q = '') => {
  await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}${q}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(5000);
};
const text = async (page) => (await page.locator('main').innerText().catch(() => '')).replace(/\s*\n\s*/g, ' | ');
async function section(name, fn) {
  if (!want(name)) return;
  log(`\n=== ${name}`);
  try { await fn(); } catch (e) { log('  FAIL', e.message.split('\n')[0].slice(0, 200)); }
}
try {
  await section('seed', async () => {
    const { ctx, page } = await fresh();
    await go(page, '/biz/journal', 'demo=owner&sphere=nails');
    const t1 = await text(page);
    const m1 = t1.match(/(\d+) ждут? подтверждения|ждёт подтверждения/g);
    log('  journal pending (now):', m1?.join(',') ?? 'none');
    log('  admin column in journal:', /Лилит Мкртчян/.test(t1));
    await page.waitForTimeout(70000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const t2 = await text(page);
    log('  journal pending (+70 s):', t2.match(/(\d+) ждут? подтверждения|ждёт подтверждения/g)?.join(',') ?? 'none', '| «Отменил мастер» today:', (t2.match(/Отменил мастер/g) ?? []).length);
    await page.screenshot({ path: `${OUT}/v5-seed-journal.png` });
    await go(page, '/biz/schedule', 'demo=owner&sphere=nails');
    const ts = await text(page);
    const i = ts.indexOf('Лилит Мкртчян');
    log('  schedule admin row:', i >= 0 ? ts.slice(i, i + 120) : 'none');
    await page.screenshot({ path: `${OUT}/v5-seed-schedule.png` });
    await go(page, '/notifications', 'demo=client');
    const tn = await text(page);
    const j = tn.indexOf('Гаяне');
    log('  client «Пора снова»:', j >= 0 ? tn.slice(j, j + 90) : 'none');
    await page.screenshot({ path: `${OUT}/v5-seed-repeat.png` });
    await go(page, '/book?staff=st_nuri_ani&service=sv_nuri_classic&slot=' + encodeURIComponent('2026-10-02T15:00'), 'demo=client');
    const tb = await text(page);
    log('  /book manicure membership:', tb.match(/Списать визит с [^|]+/)?.[0] ?? 'нет предложения');
    await page.screenshot({ path: `${OUT}/v5-book-membership.png` });
    await ctx.close();
  });

  await section('policy', async () => {
    const { ctx, page } = await fresh();
    // Клиент записывается к Эрику (Kaytsak, политика «гарантия картой», у Эрика предоплата 30 %)
    await go(page, '/book?staff=st_kaytsak_erik&service=sv_kay_cut&slot=' + encodeURIComponent('2026-10-02T12:00'), 'demo=client');
    log('  book url:', page.url());
    await page.getByRole('button', { name: /Подтвердить запись/ }).last().click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/v5-policy-booked.png` });
    await go(page, '/bookings', 'demo=client');
    const href = await page.locator('a[href^="/bookings/"]').first().getAttribute('href');
    const bookingId = href?.split('/').pop();
    log('  new booking:', bookingId);
    await go(page, `/biz/journal?booking=${bookingId}`, 'demo=owner&sphere=barber');
    await page.getByRole('tab', { name: 'Оплата' }).click();
    await page.waitForTimeout(2500);
    const tp = await page.locator('[role="dialog"], aside, main').last().innerText().catch(() => '');
    log('  prepayment shown:', /Предоплата/.test(tp), '| «политика оплаты не применяется»:', /политика оплаты не применяется/i.test(tp));
    await page.screenshot({ path: `${OUT}/v5-policy-window.png` });
    // Для сравнения — запись Kaytsak без предоплаты: там строка про политику должна остаться
    await go(page, '/biz/journal?date=2026-10-02', 'demo=owner&sphere=barber');
    await page.locator('button').filter({ hasText: /^13:00/ }).first().click();
    await page.waitForTimeout(3000);
    await page.getByRole('tab', { name: 'Оплата' }).click();
    await page.waitForTimeout(2500);
    const tq = await page.locator('[role="dialog"]').last().innerText().catch(() => '');
    log('  other booking: «политика оплаты не применяется» / блок политики:', /политика оплаты не применяется/i.test(tq), /Политика оплаты/i.test(tq));
    await page.screenshot({ path: `${OUT}/v5-policy-other.png` });
    await ctx.close();
  });

  await section('overlap', async () => {
    const { ctx, page } = await fresh();
    // У au_01 (Ани Мелкумян) в Nuri запись вс 4 октября 11:00 у Ани — пробуем записать её же к Соне на 11:00
    await go(page, '/biz/journal?date=2026-10-04&new=1&staff=st_nuri_gayane&start=11:00&phone=' + encodeURIComponent('+37400160001') + '&services=sv_nuri_classic', 'demo=owner&sphere=nails');
    await page.screenshot({ path: `${OUT}/v5-overlap-window.png` });
    await page.getByRole('button', { name: /^(Записать|Сохранить)$/ }).last().click();
    await page.waitForTimeout(2500);
    const dlg = page.getByText('У клиента уже есть запись в это время');
    log('  dialog:', (await dlg.count()) > 0 ? await page.locator('[role="alertdialog"], [role="dialog"]').last().innerText().then((s) => s.replace(/\n/g, ' | ')) : 'NO');
    await page.screenshot({ path: `${OUT}/v5-overlap-dialog.png` });
    await page.getByRole('button', { name: 'Всё равно записать' }).click();
    await page.waitForTimeout(3000);
    await go(page, '/biz/journal?date=2026-10-04', 'demo=owner&sphere=nails');
    await page.screenshot({ path: `${OUT}/v5-creator-before.png` });
    // Новая запись — в колонке Гаянэ (правее всех): блок «Ани М.» с самым большим x
    const blocks = page.locator('button').filter({ hasText: 'Ани М.' });
    const hx = (await page.getByText('Гаяне Оганесян').first().boundingBox())?.x ?? 0;
    let best = null;
    for (let i = 0; i < await blocks.count(); i++) {
      const box = await blocks.nth(i).boundingBox();
      log('   block', i, JSON.stringify(box && { x: Math.round(box.x), y: Math.round(box.y) }), 'header x', Math.round(hx));
      if (box && box.x >= hx - 80 && box.x < 1100 && box.width > 0) best = blocks.nth(i);
    }
    log('  blocks «Ани М.»:', await blocks.count());
    await best.click();
    await page.waitForTimeout(1500);
    const edit = page.getByRole('button', { name: /Открыть|Подробнее|Изменить/ }).first();
    if (!(await page.locator('[role="dialog"]').count())) await edit.click().catch(() => {});
    await page.waitForTimeout(3500);
    const win = await page.locator('[role="dialog"]').last().innerText().catch(() => '');
    const a = win.indexOf('Автор');
    log('  window head:', win.slice(0, 120).replace(/\n/g, ' | ')); log('  window author:', a >= 0 ? win.slice(a, a + 60).replace(/\n/g, ' | ') : 'none', '| owner = Нарине Акопян');
    await page.screenshot({ path: `${OUT}/v5-creator.png` });
    await ctx.close();
  });

  await section('event', async () => {
    const { ctx, page } = await fresh();
    await go(page, '/biz/finance', 'demo=individual&sphere=fitness');
    log('  finance before:', (await text(page)).match(/поступления сегодня \| [^|]+/)?.[0]);
    await go(page, '/biz/groups/events/ev_07', 'demo=individual&sphere=fitness');
    await page.locator('li[data-f~="F-01-196"] > button').first().click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Наличные', exact: true }).first().click();
    await page.waitForTimeout(2500);
    log('  toast paid:', (await page.getByText('Оплата отмечена').count()) > 0);
    await page.screenshot({ path: `${OUT}/v5-event-paid.png` });
    await go(page, '/biz/finance', 'demo=individual&sphere=fitness');
    log('  finance after pay:', (await text(page)).match(/поступления сегодня \| [^|]+/)?.[0]);
    await go(page, '/biz/groups/events/ev_07', 'demo=individual&sphere=fitness');
    await page.locator('li[data-f~="F-01-196"] > button').first().click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Отменить оплату' }).first().click();
    await page.waitForTimeout(2500);
    await go(page, '/biz/finance', 'demo=individual&sphere=fitness');
    log('  finance after cancel:', (await text(page)).match(/поступления сегодня \| [^|]+/)?.[0]);
    await ctx.close();
  });

  await section('copyweek', async () => {
    const { ctx, page } = await fresh();
    await go(page, '/biz/schedule/calendar?staff=st_nuri_sona', 'demo=owner&sphere=nails');
    const next = page.getByRole('button', { name: /Следующ/ }).first();
    await next.click(); await page.waitForTimeout(1500);
    await next.click(); await page.waitForTimeout(2500);
    log('  week:', await page.locator('button:has(svg.lucide-calendar-days)').first().innerText());
    await page.getByRole('button', { name: /Ещё|Другие действия|⋯/ }).first().click().catch(async () => page.locator('button:has(svg.lucide-ellipsis)').first().click());
    await page.waitForTimeout(800);
    await page.getByRole('menuitem', { name: 'Как на прошлой неделе' }).click();
    await page.waitForTimeout(3000);
    const dlg = page.getByText('На этой неделе есть записи');
    log('  affected dialog:', (await dlg.count()) > 0 ? (await page.locator('[role="dialog"]').last().innerText()).replace(/\n/g, ' | ').slice(0, 300) : 'NO');
    await page.screenshot({ path: `${OUT}/v5-copyweek-dialog.png` });
    await ctx.close();
  });

  await section('register', async () => {
    const { ctx, page } = await fresh(PHONE);
    await go(page, '/register-business', 'demo=client');
    await page.getByText('Салон', { exact: true }).click();
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.locator('[data-f="F-00-147"] button').first().click();
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByPlaceholder('Как назвать салон или себя').fill('QA Студия Лусаберд');
    await page.locator('input[type="tel"]').first().fill('99 456 789');
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByRole('button', { name: 'Завершить регистрацию' }).click();
    await page.waitForTimeout(7000);
    log('  after register:', page.url());
    await page.screenshot({ path: `${OUT}/v5-register-onboarding.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    const top = await page.locator('header').first().innerText().catch(() => '');
    log('  top bar:', top.replace(/\n/g, ' | ').slice(0, 160));
    await page.screenshot({ path: `${OUT}/v5-register-desktop.png` });
    await go(page, '/biz/billing', '');
    log('  billing:', (await text(page)).match(/Пробный период[^|]*(\|[^|]*){0,2}/)?.[0] ?? 'нет «Пробный период»');
    await page.screenshot({ path: `${OUT}/v5-register-billing.png` });
    await ctx.close();
  });
} finally {
  await browser.close();
  release();
}
