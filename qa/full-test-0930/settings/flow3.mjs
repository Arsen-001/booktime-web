// Решения владельца 01.10: пробный период 7 дней, «Быстрый старт» только с settings.manage; регистрация → свой пустой бизнес → первая запись
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings/flow3';
const BASE = 'http://localhost:3710';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
export async function run(browser, TYPE = 'salon', DEV = 'desktop', PROMO = '') {
  const log = (...a) => console.log(`[f3 ${TYPE}/${DEV}]`, ...a);
  const ctx = await browser.newContext(DEV === 'phone' ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(400000); page.setDefaultTimeout(30000);
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 200)));
  const shot = (n) => page.screenshot({ path: `${OUT}/${TYPE}-${DEV}-${n}.png` }).catch(() => {});
  const main = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const toasts = async () => (await page.locator('[data-sonner-toast], [role=status]').allInnerTexts().catch(() => [])).join(' | ').replace(/\s+/g, ' ');
  const NAME = TYPE === 'salon' ? 'QA Салон Роза' : 'QA Мастер Лена';
  try {
    await page.goto(`${BASE}/register-business?demo=guest&lang=ru&theme=light&empty=0`); await page.waitForTimeout(2000);
    await page.getByRole('radio', { name: TYPE === 'salon' ? /Салон/ : /Индивидуал/ }).click();
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Маникюр' }).click();
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(300);
    if (PROMO) await page.getByPlaceholder('Если есть').fill(PROMO);
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(300);
    await page.getByPlaceholder('Как назвать салон или себя').fill(NAME);
    await page.locator('input[type=tel]').first().fill('77123456');
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Завершить регистрацию' }).click();
    await page.waitForURL(/\/biz\/onboarding/, { timeout: 60000 }); await page.waitForTimeout(3500);
    await shot('01-onboarding');
    const all = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    log('own business after register (no empty=1 forced): name visible =', all.includes(NAME));
    log('onboarding:', (await main()).slice(0, 350));
    await page.goto(`${BASE}/biz/billing`); await page.waitForTimeout(3000);
    await shot('02-billing');
    log('billing:', (await main()).slice(0, 380));
    await page.goto(`${BASE}/biz/billing/manage`); await page.waitForTimeout(3000);
    const r12 = page.getByRole('radio', { name: /12/ });
    if (await r12.count()) { await r12.first().click(); await page.waitForTimeout(1500); }
    log('manage 12m:', (await main()).match(/Детализация.*?Итого [\d  ]+֏/)?.[0]);
    // быстрый старт
    await page.goto(`${BASE}/biz/onboarding/quick-start`); await page.waitForTimeout(3000);
    const tpl = page.getByRole('button', { name: 'Маникюр', exact: true });
    if (await tpl.count()) await tpl.first().click(); else await page.getByPlaceholder(/Например/).first().fill('Маникюр');
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(2000);
    if (TYPE === 'salon') {
      await page.getByPlaceholder('Например, «Анна Саргсян»').fill('Анна Тестова');
      await page.locator('main input[type=tel]').first().fill('77555111');
    }
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(2000);
    const days = page.locator('main [role=group] button[aria-pressed]');
    for (let i = 0; i < 7; i++) await days.nth(i).click().catch(() => {});
    await page.getByRole('button', { name: 'Готово' }).click(); await page.waitForTimeout(3000);
    log('quick start finished →', page.url(), '|', await toasts());
    // первая запись
    await page.goto(`${BASE}/biz/journal`); await page.waitForTimeout(4000);
    await shot('03-journal');
    // клик по сетке в 12:30 — запись в рабочее время мастера
    const row = page.getByText('12:00', { exact: true }).first();
    const rb = await row.boundingBox();
    if (rb) { await page.mouse.click(rb.x + (DEV === 'phone' ? 180 : 400), rb.y + rb.height / 2 + 40); await page.waitForTimeout(1500); }
    if (!(await page.getByRole('dialog').count())) { await page.getByRole('button', { name: /^(\+ )?(Новая запись|Запись)$/ }).first().click(); await page.waitForTimeout(1500); }
    const pick = page.getByRole('dialog').getByText('Запись', { exact: true });
    if (await pick.count()) { await pick.first().click(); await page.waitForTimeout(2000); }
    await shot('04-window');
    const dlg = page.getByRole('dialog').last();
    log('window:', (await dlg.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 700));
    const nameIn = dlg.getByPlaceholder('Имя').first();
    if (await nameIn.count()) await nameIn.fill('Клиент Первый');
    const tel = dlg.locator('input[type=tel]').first();
    if (await tel.count()) await tel.fill('99111222');
    await page.waitForTimeout(800);
    await dlg.getByText('Основные услуги').first().click().catch(() => {}); await page.waitForTimeout(800);
    const svc = dlg.getByText('Маникюр', { exact: true }).last();
    if (await svc.count()) { await svc.click().catch(() => {}); await page.waitForTimeout(1000); }
    log('time/service:', (await dlg.innerText()).replace(/\s+/g, ' ').match(/Начало.{0,40}/)?.[0], '| К оплате', (await dlg.innerText()).replace(/\s+/g, ' ').match(/К оплате.{0,12}/)?.[0]);
    const nameIn2 = dlg.getByPlaceholder('Имя').first();
    if (await nameIn2.count()) { await nameIn2.click(); await nameIn2.fill('Клиент Первый'); }
    const tel2 = dlg.locator('input[type=tel]').first();
    if (await tel2.count()) { await tel2.click(); await tel2.fill('99111222'); }
    await page.waitForTimeout(1200);
    log('client fields:', await nameIn2.inputValue().catch(() => '?'), await tel2.inputValue().catch(() => '?'));
    await shot('05-filled');
    await dlg.getByRole('button', { name: /^Записать$/ }).first().click(); await page.waitForTimeout(3000);
    const yes = page.getByRole('button', { name: /^(Да|Всё равно сохранить)$/ });
    if (await yes.count()) { log('confirm shown:', (await page.getByRole('dialog').last().innerText()).replace(/\s+/g, ' ').slice(0, 120)); await yes.first().click(); await page.waitForTimeout(2500); if (await yes.count()) { await yes.first().click(); await page.waitForTimeout(2500); } }
    log('after save:', await toasts());
    await shot('06-after-save');
    await page.goto(`${BASE}/biz/journal`); await page.waitForTimeout(4000); await shot('06b-journal-after');
    log('journal after:', (await main()).slice(0, 250));
    await page.goto(`${BASE}/biz/records`); await page.waitForTimeout(4000);
    await shot('07-records');
    log('records:', (await main()).slice(0, 400));
  } catch (e) { log('FAIL', e.message.split('\n')[0]); await shot('ZZ-fail'); }
  finally { log('errors:', errs.slice(0, 5)); await ctx.close(); }
}
