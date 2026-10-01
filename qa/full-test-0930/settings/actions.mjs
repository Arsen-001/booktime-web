// Действия по F-id раздела на живом демо-бизнесе (владелец Nuri) и на зарегистрированном бизнесе с промокодом
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/settings/actions';
const BASE = 'http://localhost:3710';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
export async function run(browser, persona = 'owner', dev = 'desktop') {
  const ctx = await browser.newContext(dev === 'phone' ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(150000); page.setDefaultTimeout(60000);
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  const tag = `${persona}-${dev}`;
  const log = (...a) => console.log(`[act ${tag}]`, ...a);
  const shot = (n) => page.screenshot({ path: `${OUT}/${tag}-${n}.png` }).catch(() => {});
  const main = async () => (await page.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const go = async (r, w = 2200) => { await page.goto(BASE + r); await page.waitForTimeout(w); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { log(name, 'FAIL', e.message.split('\n')[0]); await shot('fail-' + name); } };
  await go(`/biz/onboarding?demo=${persona}&lang=ru&theme=light&empty=0`, 1500);

  await step('coins', async () => {
    await go('/biz/coins');
    const before = await main(); log('coins before:', before.slice(0, 300));
    await page.getByRole('button', { name: 'Купить', exact: true }).click(); await page.waitForTimeout(700);
    await shot('coins-sheet');
    const dlg = page.getByRole('dialog');
    log('sheet:', (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 300));
    await dlg.getByText('500 монет').first().click();
    await dlg.getByRole('button', { name: 'Оплатить' }).click(); await page.waitForTimeout(1500);
    await shot('coins-after');
    log('coins after:', (await main()).slice(0, 400));
    await page.reload(); await page.waitForTimeout(2200);
    log('coins after reload:', (await main()).slice(0, 200));
  });

  await step('billing', async () => {
    await go('/biz/billing');
    await shot('billing');
    log('billing:', (await main()).slice(0, 700));
    const sw = page.getByRole('switch').first();
    const was = await sw.getAttribute('aria-checked');
    await sw.click(); await page.waitForTimeout(800);
    const cd = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    if (await cd.count()) { log('confirm dialog:', (await cd.first().innerText()).replace(/\s+/g, ' ').slice(0, 200)); await shot('autorenew-confirm'); await cd.first().getByRole('button', { name: 'Отменить', exact: true }).click(); await page.waitForTimeout(1200); }
    const toast = await page.locator('[role=status], [data-sonner-toast], [role=alert]').allInnerTexts();
    log('autorenew', was, '→', await sw.getAttribute('aria-checked'), 'toast:', toast.join(' | ').slice(0, 120));
    await page.reload(); await page.waitForTimeout(2200);
    log('autorenew after reload:', await page.getByRole('switch').first().getAttribute('aria-checked'));
  });

  await step('manage', async () => {
    await go('/biz/billing/manage');
    const m1 = await main(); log('manage 1:', m1.slice(0, 700));
    const opt = page.getByRole('radio', { name: /12/ });
    if (await opt.count()) { await opt.first().click(); await page.waitForTimeout(1200); }
    await shot('manage-12');
    log('manage 12:', (await main()).slice(0, 700));
    await page.getByRole('link', { name: /Перейти к оплате/ }).or(page.getByRole('button', { name: /Перейти к оплате/ })).first().click();
    await page.waitForTimeout(2200);
    log('checkout url', page.url());
    await shot('checkout');
    log('checkout:', (await main()).slice(0, 500));
    const payBtn = page.getByRole('button', { name: 'Оплатить' });
    log('pay disabled before agree:', await payBtn.isDisabled());
    await page.getByRole('checkbox').first().click();
    await payBtn.click(); await page.waitForTimeout(2500);
    log('result url', page.url()); await shot('result');
    log('result:', (await main()).slice(0, 300));
    await go('/biz/billing/invoices'); await shot('invoices');
    log('invoices:', (await main()).slice(0, 400));
    await go('/biz/billing');
    log('billing after pay:', (await main()).slice(0, 300));
  });

  await step('invoice-firm', async () => {
    await go('/biz/billing/checkout?months=1');
    await page.getByRole('radio', { name: /Счёт/ }).first().click(); await page.waitForTimeout(500);
    await page.getByRole('checkbox').first().click();
    await page.getByRole('button', { name: /счёт/i }).last().click(); await page.waitForTimeout(800);
    log('invoice without address still here:', page.url().includes('/checkout?'), (await page.locator('.text-danger').allInnerTexts()).join('|'));
    await page.getByPlaceholder(/./).last().fill('Ереван, ул. Абовяна, 1');
    await page.getByRole('button', { name: /счёт/i }).last().click(); await page.waitForTimeout(2500);
    log('invoice result url', page.url()); await shot('invoice-result');
    log('invoice result:', (await main()).slice(0, 300));
  });

  await step('seats', async () => { await go('/biz/billing/seats'); await shot('seats'); log('seats:', (await main()).slice(0, 700)); });

  await step('contacts', async () => {
    await go('/biz/settings/contacts'); await shot('contacts');
    const inputs = page.locator('main input[type=text], main input:not([type]), main textarea');
    log('contacts inputs:', await inputs.count(), (await main()).slice(0, 300));
  });

  await step('hub', async () => {
    await go('/biz/settings'); await shot('hub');
    const links = await page.locator('main a').evaluateAll((as) => as.map((a) => a.getAttribute('href')).filter(Boolean));
    log('hub links', links.length, [...new Set(links)].join(' '));
    // все ссылки хаба открываются без ошибки
    for (const h of [...new Set(links)].filter((h) => h.startsWith('/'))) {
      const r = await page.request.get(BASE + h).catch(() => null);
      if (!r || r.status() >= 400) log('hub link broken', h, r?.status());
    }
  });

  log('errors:', errs.slice(0, 8));
  await ctx.close();
}
