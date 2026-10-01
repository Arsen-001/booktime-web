import { start, stop, open, go, as, reload, text, shot, db, toasts, pick, wizardToDetails } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online/widget');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'O3-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('skip-links', async () => { return;
  await page.getByPlaceholder('https://apps.apple.com/…').fill('https://apps.apple.com/app/nuri-c3');
  const sec = page.locator('main section, main div').filter({ hasText: /^Мобильные приложения/ }).last();
  await page.getByRole('button', { name: 'Сохранить' }).last().click(); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
  await reload(page); console.log('widget page after reload:', await page.getByPlaceholder('https://apps.apple.com/…').inputValue());
  await go(page, '/biz/apps/branded'); console.log('branded page ios:', await page.getByPlaceholder('https://apps.apple.com/…').inputValue());
});
await step('book-in-widget', async () => {
  await as(page, 'guest', '/b/nuri-nail-studio/book');
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(800);
    if (await page.getByPlaceholder('Введите имя').count()) break;
    const und = page.getByRole('button', { name: 'Понятно' }); if (await und.count()) { await und.click(); await page.waitForTimeout(400); }
    const body = await page.locator('body').innerText();
    if (await page.getByRole('button', { name: 'Индивидуальная запись' }).count()) { await page.getByRole('button', { name: 'Индивидуальная запись' }).click(); continue; }
    const time = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ });
    if (await time.count()) await time.first().click();
    else if (/Мастер/.test(body) && body.includes('Сона Григорян') && !body.includes('Маникюр классический')) await page.getByText('Сона Григорян').first().click();
    else if (body.includes('Маникюр классический')) await page.getByText('Маникюр классический').first().click();
    else if (body.includes('Сона Григорян')) await page.getByText('Сона Григорян').first().click();
    await page.waitForTimeout(300);
    const und2 = page.getByRole('button', { name: 'Понятно' }); if (await und2.count()) { await und2.click(); await page.waitForTimeout(400); }
    const cont = page.getByRole('button', { name: /Продолжить/ }); if (await cont.count() && await cont.first().isEnabled()) await cont.first().click();
  }
  console.log('details?', await page.getByPlaceholder('Введите имя').count());
  await page.getByPlaceholder('Введите имя').fill('Проверка Цэ');
  const ph = page.locator('main input[type=tel], main input[inputmode=tel]').first(); await ph.fill('91 234 999');
  const pk = page.getByRole('button', { name: 'Гаяне Оганесян' }).or(page.getByRole('radio', { name: /Гаяне Оганесян/ })); if (await pk.count()) { await pk.first().click(); await page.waitForTimeout(400); }
  await page.getByRole('button', { name: 'Получить код' }).click(); await page.waitForTimeout(1200);
  const code = page.locator('input[autocomplete=one-time-code], input[inputmode=numeric]').last(); console.log('code inputs', await code.count()); await code.fill('0000'); await page.waitForTimeout(800);
  const conf = page.getByRole('button', { name: /Подтвердить/ }); if (await conf.count()) { await conf.first().click(); await page.waitForTimeout(1000); }
  console.log('after code:', (await page.locator('main').innerText()).split('\n').filter(l => /код|Номер|подтвержд/i.test(l)).slice(0, 4));
  const cb = page.locator('main input[type=checkbox]'); for (let i = 0; i < await cb.count(); i++) { if (!(await cb.nth(i).isChecked())) await cb.nth(i).check().catch(()=>{}); }
  const b = page.getByRole('button', { name: /Записаться|Записать|Подтвердить запись/ }).last(); console.log('final btn', await b.innerText(), await b.isEnabled()); await b.click(); await page.waitForTimeout(3000);
  const t = await T(4000); console.log('after book:', t.replace(/\n/g, ' | ').slice(0, 700));
  console.log('has app link?', t.includes('App Store') || (await page.locator('a[href*="apps.apple.com"]').count()));
  await shot(page, 'O3-after-book', true);
});
await stop();
