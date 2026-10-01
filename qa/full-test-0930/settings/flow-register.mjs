// Регистрация нового бизнеса → быстрый старт → первая запись (QA 30.09, раздел settings)
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings';
const BASE = 'http://localhost:3710';
export async function run(browser, TYPE = 'salon', DEV = 'desktop') {
const log = (...a) => console.log(`[${TYPE}/${DEV}]`, ...a);
const ctx = await browser.newContext(DEV === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 200)));
const shot = (n) => page.screenshot({ path: `${OUT}/${TYPE}-${DEV}-${n}.png` });
const settle = () => page.waitForTimeout(900);
try {
  await page.goto(`${BASE}/register-business?demo=guest&lang=ru&theme=light&empty=0`); await settle();
  await shot('01-type');
  await page.getByRole('radio', { name: TYPE === 'salon' ? /Салон/ : /Индивидуал/ }).click();
  await page.getByRole('button', { name: 'Далее' }).click(); await settle();
  // пропуск сферы — ошибка
  await page.getByRole('button', { name: 'Далее' }).click(); await settle();
  log('sphere error shown:', await page.getByText('Выберите хотя бы одну сферу').isVisible());
  await page.getByRole('button', { name: 'Маникюр' }).click();
  await page.getByRole('button', { name: 'Массаж' }).click();
  await shot('02-sphere');
  await page.getByRole('button', { name: 'Далее' }).click(); await settle();
  await page.getByPlaceholder('Если есть').fill(process.env.PROMO || 'NEWSALON');
  await shot('03-promo');
  await page.getByRole('button', { name: 'Далее' }).click(); await settle();
  const NAME = TYPE === 'salon' ? 'QA Салон Тест' : 'QA Мастер Тест';
  await page.getByPlaceholder('Как назвать салон или себя').fill(NAME);
  await page.getByPlaceholder('Как к вам обращаться').fill('Арсен');
  const phone = page.locator('input[type=tel]').first();
  await phone.fill('77123456');
  await shot('04-contact');
  log('next enabled:', await page.getByRole('button', { name: 'Далее' }).isEnabled());
  await page.getByRole('button', { name: 'Далее' }).click(); await settle();
  await page.getByRole('button', { name: 'Онлайн-запись' }).click();
  await shot('05-goals');
  await page.getByRole('button', { name: 'Завершить регистрацию' }).click();
  await page.waitForURL(/\/biz\/onboarding/, { timeout: 15000 }); await page.waitForTimeout(2500);
  await shot('06-onboarding');
  const body = await page.locator('body').innerText();
  log('URL', page.url());
  log('name visible on page:', body.includes(NAME));
  log('onboarding text:', body.replace(/\s+/g, ' ').slice(0, 700));
  // Кабинет: какой бизнес открыт?
  await page.goto(`${BASE}/biz/settings/contacts`); await page.waitForTimeout(2500);
  await shot('07-contacts');
  const cb = await page.locator('main').innerText().catch(() => '');
  log('contacts page has NAME:', cb.includes(NAME), '| snippet:', cb.replace(/\s+/g, ' ').slice(0, 300));
  // Подписка: промокод применён?
  await page.goto(`${BASE}/biz/billing`); await page.waitForTimeout(2500);
  await shot('08-billing');
  log('billing:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 900));
  // Промокод NEWSALON: 1 мес — 0 %, 12 мес — 25 % (F-00-020)
  await page.goto(`${BASE}/biz/billing/manage`); await page.waitForTimeout(2500);
  log('manage 1m:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600));
  const r12 = page.getByRole('radio', { name: /12/ });
  if (await r12.count()) { await r12.first().click(); await page.waitForTimeout(1500); }
  await shot('08b-manage-12');
  log('manage 12m:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600));
  // Быстрый старт
  await page.goto(`${BASE}/biz/onboarding/quick-start`); await page.waitForTimeout(2000);
  await shot('09-qs1');
  const tpl = page.getByRole('button', { name: 'Маникюр', exact: true });
  if (await tpl.count()) await tpl.first().click();
  else await page.getByPlaceholder(/Например, «Маникюр/).fill('Маникюр');
  await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(1500);
  await shot('10-qs2');
  if (TYPE === 'salon') {
    await page.getByPlaceholder('Например, «Анна Саргсян»').fill('Анна Тестова');
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(1500);
    const stuck = await page.getByPlaceholder('Например, «Анна Саргсян»').isVisible().catch(() => false);
    log('salon step2 without phone: still on step2 =', stuck, '| visible error:', await page.locator('.text-danger, [role=alert]').allInnerTexts());
    await shot('10b-qs2-nophone');
    if (stuck) {
      const ph = page.getByPlaceholder('+374').or(page.locator('input[type=tel]'));
      await ph.first().fill('+37477555111');
      await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(1500);
    }
  } else {
    await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(1500);
  }
  await shot('11-qs3');
  // все будни
  for (const d of ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']) {
    const b = page.getByRole('button', { name: new RegExp(`^${d}`) }).or(page.getByRole('checkbox', { name: new RegExp(`^${d}`) }));
    if (await b.count()) await b.first().click().catch(() => {});
  }
  await shot('11b-qs3-days');
  await page.getByRole('button', { name: 'Готово' }).click();
  await page.waitForTimeout(3000);
  log('after finish URL', page.url());
  await shot('12-tour');
  await page.goto(`${BASE}/biz/onboarding`); await page.waitForTimeout(2500);
  await shot('13-onboarding-after');
  log('onboarding after:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 900));
  // Журнал
  await page.goto(`${BASE}/biz/journal`); await page.waitForTimeout(3000);
  await shot('14-journal');
  log('journal:', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600));
} catch (e) {
  log('FAIL', e.message.split('\n')[0]);
  await shot('ZZ-fail').catch(() => {});
} finally {
  log('console errors:', errors.slice(0, 10));
  await ctx.close();
}
}
