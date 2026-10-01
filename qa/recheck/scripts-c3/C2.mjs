import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/apps/branded');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'C2-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
const priceBlock = async () => { const t = await T(6000); const i = t.indexOf('Годовая цена'); return t.slice(i, i + 260).replace(/\n/g, ' | '); };
await step('price', async () => {
  console.log('0:', await priceBlock());
  await page.getByRole('button', { name: '+' }).click(); await page.waitForTimeout(400);
  console.log('+1:', await priceBlock());
  await page.getByRole('button', { name: '+' }).click(); await page.waitForTimeout(400);
  console.log('+2:', await priceBlock());
  await shot(page, 'C2-price');
});
await step('docs', async () => {
  const t = await T(8000); const i = t.indexOf('Документы и доступы'); console.log(t.slice(i, i + 400).replace(/\n/g, ' | '));
  const all = await page.locator('main button').allInnerTexts(); console.log('buttons:', all.filter(Boolean).join(' / ').slice(0, 600));
});
await step('links-persist', async () => {
  await page.getByPlaceholder('https://apps.apple.com/…').fill('https://apps.apple.com/app/id999');
  await page.waitForTimeout(400);
  const all = await page.locator('main button').allInnerTexts(); console.log('buttons now:', all.filter(Boolean).slice(0, 8).join(' / '));
  const sv = page.getByRole('button', { name: /Сохранить/ }); console.log('save btns', await sv.count());
  if (await sv.count()) { await sv.first().click(); await page.waitForTimeout(1000); console.log('toasts', await toasts(page)); }
  await reload(page);
  console.log('ios after reload =', await page.getByPlaceholder('https://apps.apple.com/…').inputValue());
});
await step('desc-validation', async () => {
  const ta = page.locator('main textarea').first();
  await ta.fill('Звоните +374 91 234 567 или пишите на www.nuri.am'); await ta.blur(); await page.waitForTimeout(600);
  const t = await T(9000); console.log('errors:', t.split('\n').filter(l => /Уберите|номер|ссылк/i.test(l)).slice(0, 5));
  await shot(page, 'C2-desc-validation');
});
await step('admin-login-password', async () => {
  await as(page, 'guest', '/login');
  await page.getByRole('radio', { name: 'Мастер или бизнес' }).click(); await page.waitForTimeout(500);
  console.log((await T(900)).replace(/\n/g, ' | '));
  const tabs = await page.locator('main button').allInnerTexts(); console.log('btns', tabs.join(' / '));
});
await stop();
