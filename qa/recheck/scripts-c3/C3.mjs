import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('individual', '/biz/apps/branded');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'C3-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
const priceBlock = async () => { const t = await T(6000); const i = t.indexOf('Базовая цена'); return t.slice(i, i + 160).replace(/\n/g, ' | '); };
await step('stage', async () => { console.log((await T(400)).replace(/\n/g,' | ')); });
await step('price', async () => {
  console.log('0:', await priceBlock());
  await page.getByRole('button', { name: '+' }).click(); await page.waitForTimeout(700);
  console.log('+1:', await priceBlock());
  await page.getByRole('button', { name: '−' }).click(); await page.waitForTimeout(700);
});
await step('submit-blocked', async () => {
  const t = await T(12000); const bl = t.split('\n').filter(l => /не хватает|Не хватает|Отправить заявку/i.test(l)); console.log(bl.slice(0, 5));
  const sb = page.getByRole('button', { name: /Отправить/ }); console.log('submit count', await sb.count(), await sb.last().isEnabled().catch(()=>'-'));
});
await step('links', async () => {
  await page.getByPlaceholder('https://apps.apple.com/…').fill('https://apps.apple.com/app/id999'); await page.waitForTimeout(300);
  const sv = page.getByRole('button', { name: /Сохранить ссылки/ }); console.log('save', await sv.count());
  await sv.first().click(); await page.waitForTimeout(1000); console.log(await toasts(page));
  await reload(page); console.log('after reload', await page.getByPlaceholder('https://apps.apple.com/…').inputValue());
});
await stop();
