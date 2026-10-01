import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/loyalty/promotions/new');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'L4-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
const cont = () => page.getByRole('button', { name: 'Продолжить' }).click().then(() => page.waitForTimeout(700));
await step('wizard', async () => {
  const before = (await db(page)).areas.loyalty.promotions.length;
  await page.locator('main input').first().fill('Проверка C3 акция');
  await cont(); console.log('S2:', (await T(900)).split('\n').slice(10, 30).join(' | '));
  // choose first kind tile
  const tiles = page.locator('main [role=radio], main button[aria-pressed], main label');
  console.log('tiles', await tiles.count());
  await cont(); console.log('S3?', (await T(1400)).split('\n').slice(10, 30).join(' | '));
  await cont(); console.log('S4?', (await T(1400)).split('\n').slice(10, 30).join(' | '));
  await page.getByRole('button', { name: 'Назад' }).last().click(); await page.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { const b = page.getByRole('button', { name: /^Назад$/ }); if (await b.count()) { await b.last().click(); await page.waitForTimeout(400);} }
  console.log('back at S1 name =', await page.locator('main input').first().inputValue().catch(e=>'ERR '+e.message));
  await page.getByRole('button', { name: 'Отмена' }).click(); await page.waitForTimeout(1500);
  console.log('after cancel url', page.url(), 'dialog?', await page.locator('[role=dialog],[role=alertdialog]').count());
  if (await page.locator('[role=alertdialog],[role=dialog]').count()) { console.log('dlg:', await page.locator('[role=alertdialog],[role=dialog]').last().innerText()); }
  const after = (await db(page)).areas.loyalty.promotions.length; console.log('promos before/after', before, after);
});
await step('empty-persona-promotions', async () => {
  await as(page, 'owner', '/biz/loyalty/promotions', '&empty=1');
  console.log(await T(700));
  const btns = page.locator('main button, main a');
  const names = await btns.allInnerTexts(); console.log('buttons', names);
  const b = page.getByRole('link', { name: /тип карты/i }).or(page.getByRole('button', { name: /тип карты/i }));
  if (await b.count()) { await b.first().click(); await page.waitForTimeout(1500); console.log('after click url', page.url(), await toasts(page)); }
  await as(page, 'owner', '/biz/loyalty/promotions/new', '&empty=1');
  console.log('direct new with no types:', (await T(600)).replace(/\n/g,' | '));
  await shot(page, 'L4-empty-promo-new');
});
await step('master-rights', async () => {
  for (const r of ['/biz/loyalty', '/biz/loyalty/certificates', '/biz/loyalty/transactions', '/biz/loyalty/certificates/lcert_biz_nuri_5', '/biz/loyalty/deposits']) {
    await as(page, 'master', r, '&empty=0');
    console.log(r, '→', (await T(250)).replace(/\n/g, ' | '));
  }
  await shot(page, 'L4-master-deposits');
});
await stop();
