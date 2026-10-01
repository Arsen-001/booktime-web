// Регистрация (диагностика) → вход в пустой бизнес → быстрый старт → первая запись
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings/flow2';
const BASE = 'http://localhost:3710';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
export async function run(browser, TYPE = 'salon', DEV = 'desktop', PROMO = '') {
  const log = (...a) => console.log(`[f2 ${TYPE}/${DEV}/${PROMO || 'nopromo'}]`, ...a);
  const ctx = await browser.newContext(DEV === 'phone' ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(150000); page.setDefaultTimeout(60000);
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const shot = (n) => page.screenshot({ path: `${OUT}/${TYPE}-${DEV}-${PROMO || 'np'}-${n}.png` }).catch(() => {});
  const main = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const toasts = async () => (await page.locator('[data-sonner-toast], [role=status], [role=alert], [data-toast]').allInnerTexts().catch(() => [])).join(' | ').replace(/\s+/g, ' ');
  const NAME = TYPE === 'salon' ? 'QA Салон Лилия' : 'QA Мастер Ани';
  try {
    if (PROMO === 'skip') {
      // Регистрация недоступна (клиентские маршруты не отвечают) — начинаем с пустого бизнеса, куда она пишет
      await page.goto(`${BASE}/biz/onboarding?demo=${TYPE === 'salon' ? 'owner' : 'individual'}&lang=ru&theme=light&empty=1`); await page.waitForTimeout(2500);
    } else {
    await page.goto(`${BASE}/register-business?demo=guest&lang=ru&theme=light&empty=0`); await page.waitForTimeout(1500);
    await page.getByRole('radio', { name: TYPE === 'salon' ? /Салон/ : /Индивидуал/ }).click();
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Маникюр' }).click();
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(400);
    if (PROMO) await page.getByPlaceholder('Если есть').fill(PROMO);
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(400);
    await page.getByPlaceholder('Как назвать салон или себя').fill(NAME);
    await page.locator('input[type=tel]').first().fill('77123456');
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Завершить регистрацию' }).click();
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(500); const t = await toasts(); if (t) { log('toast:', t); break; } }
    await page.waitForTimeout(2500);
    log('url after submit', page.url());
    await shot('01-after-submit');
    if (!page.url().includes('/biz')) { log('registration did NOT finish'); return; }
    }
    const who = await page.locator('header, nav, aside').first().innerText().catch(() => '');
    log('header after register:', who.replace(/\s+/g, ' ').slice(0, 150));
    // Переключаемся в «пустой» бизнес, куда регистрация записала данные
    await page.goto(`${BASE}/biz/onboarding?empty=1`); await page.waitForTimeout(2500);
    await shot('02-onboarding-empty1');
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    log('with empty=1 name visible:', body.includes(NAME), '|', (await main()).slice(0, 500));
    await page.goto(`${BASE}/biz/billing`); await page.waitForTimeout(2200);
    await shot('03-billing');
    log('billing:', (await main()).slice(0, 450));
    await page.goto(`${BASE}/biz/billing/manage`); await page.waitForTimeout(2200);
    const r12 = page.getByRole('radio', { name: /12/ });
    log('manage 1m:', (await main()).match(/Детализация.*?Итого [\d  ]+֏/)?.[0]);
    if (await r12.count()) { await r12.first().click(); await page.waitForTimeout(1500); }
    await shot('04-manage12');
    log('manage 12m:', (await main()).match(/Детализация.*?Итого [\d  ]+֏/)?.[0]);
    // Быстрый старт
    await page.goto(`${BASE}/biz/onboarding/quick-start`); await page.waitForTimeout(2200);
    await shot('05-qs1');
    const tpl = page.getByRole('button', { name: 'Маникюр', exact: true });
    if (await tpl.count()) await tpl.first().click(); else await page.getByPlaceholder(/Например/).first().fill('Маникюр');
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(1800);
    log('qs step1 toast:', await toasts());
    await shot('06-qs2');
    if (TYPE === 'salon') {
      await page.getByPlaceholder('Например, «Анна Саргсян»').fill('Анна Тестова');
      await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(1200);
      log('salon step2 w/o phone errors:', (await page.locator('main').getByText(/номер|Заполните/).allInnerTexts()).join(' | '));
      await shot('06b-qs2-nophone');
      await page.locator('main input[type=tel]').first().fill('77555111');
      await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(1800);
    } else {
      await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(1800);
    }
    log('qs step2 toast:', await toasts());
    await shot('07-qs3');
    await page.getByRole('button', { name: 'Готово' }).click(); await page.waitForTimeout(800);
    log('qs3 w/o days error:', (await page.locator('main').getByText('Заполните это поле').count()));
    const days = page.locator('main [role=group] button, main [role=checkbox]');
    log('weekday controls:', await days.count());
    const n = await days.count();
    for (let i = 0; i < Math.min(n, 7); i++) await days.nth(i).click().catch(() => {});
    await shot('07b-qs3-days');
    await page.getByRole('button', { name: 'Готово' }).click(); await page.waitForTimeout(3000);
    log('after finish URL', page.url(), 'toast:', await toasts());
    await shot('08-after-finish');
    await page.goto(`${BASE}/biz/onboarding`); await page.waitForTimeout(2500);
    await shot('09-onboarding-after');
    log('checklist after:', (await main()).slice(0, 600));
    // Первая запись в журнале
    await page.goto(`${BASE}/biz/journal`); await page.waitForTimeout(3000);
    await shot('10-journal');
    log('journal:', (await main()).slice(0, 300));
    await page.getByRole('button', { name: /^(\+ )?(Новая запись|Запись)$/ }).first().click(); await page.waitForTimeout(1500);
    await shot('11-new-booking');
    const pick = page.getByRole('dialog').getByText('Запись', { exact: true });
    if (await pick.count()) { await pick.first().click(); await page.waitForTimeout(1500); }
    await shot('12-window');
    const dlg = page.getByRole('dialog').last();
    log('booking window:', (await dlg.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 900));
    const inputs = await dlg.locator('input').evaluateAll((els) => els.map((e) => `${e.type}|${e.placeholder}|${e.getAttribute('aria-label')}`));
    log('window inputs:', inputs.join(' ;; '));
    const btns = await dlg.getByRole('button').allInnerTexts();
    log('window buttons:', btns.map((b) => b.replace(/\s+/g, ' ')).filter(Boolean).join(' ;; ').slice(0, 800));
    // клиент: имя + телефон
    const tel = dlg.locator('input[type=tel]').first();
    const txt = dlg.locator('input[type=text], input:not([type])').first();
    if (await txt.count()) { await txt.fill('Клиент Первый'); await page.waitForTimeout(800); }
    if (await tel.count()) { await tel.fill('99111222'); await page.waitForTimeout(800); }
    await shot('13-window-client');
    const svc = dlg.getByText('Маникюр').first();
    if (await svc.count()) { await svc.click().catch(() => {}); await page.waitForTimeout(800); }
    await shot('14-window-service');
    const save = dlg.getByRole('button', { name: /^Записать$/ }).or(dlg.getByRole('button', { name: 'Записать без клиента' }));
    log('save buttons:', await save.count());
    if (await save.count()) { await save.first().click(); await page.waitForTimeout(2500); }
    log('after save toast:', await toasts());
    const cd = page.getByRole('alertdialog');
    if (await cd.count()) { log('confirm:', (await cd.innerText()).replace(/\s+/g, ' ').slice(0, 200)); await shot('15-confirm'); }
    await shot('15-after-save');
    await page.goto(`${BASE}/biz/journal`); await page.waitForTimeout(3000);
    await shot('16-journal-after');
    log('journal after:', (await main()).slice(0, 400));
  } catch (e) {
    log('FAIL', e.message.split('\n')[0]); await shot('ZZ-fail');
  } finally {
    log('errors:', errs.slice(0, 6));
    await ctx.close();
  }
}
