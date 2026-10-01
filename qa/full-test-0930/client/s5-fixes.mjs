// С5: перепроверка правок по замечаниям координатора (A–E) и Telegram в профиле
import { start, newPage, go, shot, text, coreGet, hydrate, areaGet } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
const step = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    log(`STEP FAILED ${name}:`, String(e.message).slice(0, 300));
  }
};
try {
  const { page, errors, ctx } = await newPage(browser);
  await go(page, '/');
  // C: «принимает только …» — женщине у мастера «только женщин» окна нет, у «только мужчин» — есть, без «только только»
  await step('accepts', async () => {
    await go(page, '/book?staff=st_manana_tamara');
    await page.waitForTimeout(1500);
    log('C women-only master, dialog count:', await page.getByRole('dialog').count());
    await go(page, '/book?staff=st_kaytsak_david');
    await page.waitForTimeout(1500);
    const dlg = page.getByRole('dialog');
    log('C men-only master dialog:', (await dlg.count()) ? await dlg.first().innerText() : 'none');
    await shot(page, 's5-01-accepts-men');
  });
  // D: лист ожидания — после «Встать в очередь» видно, что уже в очереди
  await step('waitlist', async () => {
    await go(page, '/masters/st_kaytsak_erik');
    await page.getByRole('button', { name: 'Сообщить, если освободится' }).click();
    await page.waitForTimeout(800);
    await page.getByRole('dialog').getByRole('button', { name: 'Встать в очередь' }).click();
    await page.waitForTimeout(2000);
    const t = await text(page);
    log('D in queue text:', t.includes('Вы в листе ожидания'), 'cta still:', t.includes('Сообщить, если освободится'));
    await page.getByText('Вы в листе ожидания').scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, 's5-02-waitlist-inqueue');
  });
  // Telegram в профиле
  await step('telegram', async () => {
    await go(page, '/profile');
    await page.getByText('Напоминания в Telegram').scrollIntoViewIfNeeded();
    await shot(page, 's5-03-profile-telegram');
    await page.getByRole('button', { name: 'Подключить Telegram' }).click();
    await page.waitForTimeout(1500);
    await shot(page, 's5-04-profile-telegram-linked');
    await page.reload();
    await hydrate(page);
    log('TG linked after reload:', (await text(page)).includes('Подключено'));
  });
  // A: отменили вовремя оплаченную → «Предоплата вернётся»; мастер «Вернул» → «Предоплата возвращена»
  await step('refund', async () => {
    // Готовим оплаченную и вовремя отменённую запись правкой базы (экран мастера «Деньги пришли» проверен в s3)
    await go(page, '/bookings');
    const href = await page.locator('a[href^="/bookings/bk"]').first().getAttribute('href');
    const id = href.split('/').pop();
    await go(page, href);
    const conf = page.getByRole('button', { name: /Подтвердить, что приду|приду/ });
    if (await conf.count()) { await conf.first().click(); await page.waitForTimeout(1500); }
    await page.waitForTimeout(1000);
    const patch = (extra) => page.evaluate(({ id, extra }) => {
      const k = 'bp-mock-db:core:bookings';
      const arr = JSON.parse(localStorage.getItem(k));
      if (!arr) return 'no key';
      const x = arr.find((y) => y.id === id);
      x.status = 'cancelled_by_client';
      x.prepayment = { amount: 2100, paid: true, ...extra };
      localStorage.setItem(k, JSON.stringify(arr));
      return 'ok';
    }, { id, extra });
    log('A patch', await patch({ refundDue: 2100 }));
    await page.reload();
    await hydrate(page);
    log('A before «Вернул»:', JSON.stringify((await text(page)).match(/Предоплата[^\n]*\n[^\n]*/g)));
    await shot(page, 's5-05a-refund-pending');
    log('A patch2', await patch({ refundDue: 0, refundedAt: '2026-10-01T00:30' }));
    await page.reload();
    await hydrate(page);
    log('A after «Вернул»:', JSON.stringify((await text(page)).match(/Предоплата[^\n]*\n[^\n]*/g)));
    await shot(page, 's5-05b-refunded');
  });
  // B: регистрация бизнеса → свой пустой кабинет, а не Nuri
  await step('register', async () => {
    await go(page, '/register-business');
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Барбер' }).first().click();
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('textbox').first().fill('QA Барбершоп');
    await page.locator('input[type=tel]').fill('99123456');
    await page.getByRole('button', { name: 'Далее' }).click();
    await page.waitForTimeout(400);
    await shot(page, 's5-06-register-last');
    const submit = page.getByRole('button', { name: /Завершить|Зарегистрировать|Создать/ });
    log('B submit label:', await submit.first().innerText().catch(() => '?'));
    await submit.first().click();
    await page.waitForURL(/\/biz/, { timeout: 240000 }).catch(() => {});
    await page.waitForTimeout(4000);
    log('B url after submit:', page.url());
    const body = await page.evaluate(() => document.body.innerText);
    log('B shows Nuri:', body.includes('Nuri'), 'shows QA Барбершоп:', body.includes('QA Барбершоп'));
    await shot(page, 's5-07-after-register');
  });
  log('errors', errors);
  await ctx.close();
} finally {
  await done();
}
