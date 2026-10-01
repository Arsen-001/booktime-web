import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'O5-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
const linkHref = await page.locator('main a[href^="/biz/online/links/"]').filter({ hasText: 'Настроить' }).first().getAttribute('href');
await step('step-order', async () => {
  await go(page, linkHref);
  await page.getByRole('button', { name: 'Переместить ниже' }).first().click(); await page.waitForTimeout(400);
  const sv = page.getByRole('button', { name: 'Сохранить' }).last(); console.log('save enabled', await sv.isEnabled());
  await sv.click(); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
  await as(page, 'guest', '/b/nuri-nail-studio/book'); await page.waitForTimeout(800);
  const t = await T(1500); console.log('widget first step:', t.split('\n').slice(0, 12).join(' | '));
  await shot(page, 'O5-widget-order');
});
await step('unsaved-leave', async () => {
  await as(page, 'owner', linkHref);
  await page.locator('main input[type=text]').first().fill('Описание C3 несохранённое'); await page.waitForTimeout(300);
  await page.locator('a[href="/biz/journal"]').first().click(); await page.waitForTimeout(1500);
  console.log('url after nav', page.url(), 'dialog', await page.locator('[role=dialog],[role=alertdialog]').count(), (await page.locator('[role=dialog],[role=alertdialog]').last().innerText().catch(()=>'')).replace(/\n/g,' | ').slice(0, 200));
});
await step('hide-price-button-text', async () => {
  await as(page, 'owner', linkHref);
  const t = await T(20000);
  const sw = page.getByRole('switch'); const n = await sw.count();
  // find switches by nearby label text
  const hideRow = page.locator('main label, main div').filter({ hasText: /^Скрыть цену услуг в виджете$/ }).last();
  const hs = page.locator('main').getByRole('switch', { name: /Скрыть цену/ }); console.log('hide price switch by name', await hs.count());
  if (await hs.count()) await hs.first().click(); else { const all = await sw.evaluateAll(a => a.map(x => x.closest('div')?.parentElement?.innerText?.slice(0, 40))); console.log('switch labels', all); }
  const bt = page.locator('main input[type=text]').filter({ hasText: '' }); 
  const labels = await page.locator('main input[type=text]').evaluateAll(a => a.map(x => (x.closest('label, div')?.innerText || '').slice(0, 40).replace(/\n/g, ' ')));
  const idx = labels.findIndex(l => /Текст кнопки/.test(l)); console.log('button text input idx', idx);
  if (idx >= 0) await page.locator('main input[type=text]').nth(idx).fill('Хочу к вам');
  await page.getByRole('button', { name: 'Сохранить' }).last().click(); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
  await as(page, 'guest', '/b/nuri-nail-studio'); const w = await T(3000); console.log('public page has "Хочу к вам"?', w.includes('Хочу к вам'), '| prices shown:', (w.match(/\d[\d\s]*֏/g) || []).length);
  await as(page, 'guest', '/b/nuri-nail-studio/book'); await page.waitForTimeout(800); const w2 = await T(3000); console.log('book page prices shown:', (w2.match(/\d[\d\s]*֏/g) || []).slice(0, 4), '| has Хочу к вам', w2.includes('Хочу к вам'));
  await shot(page, 'O5-hide-price');
});
await stop();
