import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'O6-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page, 'body')).slice(0, n);
const linkHref = await page.locator('main a[href^="/biz/online/links/"]').filter({ hasText: 'Настроить' }).first().getAttribute('href');
await step('hide-price-deep', async () => {
  await go(page, linkHref);
  await page.locator('main').getByRole('switch', { name: /Скрыть цену/ }).first().click();
  await page.getByRole('button', { name: 'Сохранить' }).last().click(); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
  await as(page, 'guest', '/b/nuri-nail-studio/book');
  await page.getByRole('button', { name: 'Индивидуальная запись' }).click(); await page.waitForTimeout(1000);
  let t = await T(4000); console.log('service step prices:', (t.match(/\d[\d  ]*֏/g) || []).length, t.split('\n').slice(0, 8).join(' | '));
  await page.getByText('Педикюр классический', { exact: true }).first().click(); await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Продолжить/ }).first().click(); await page.waitForTimeout(1000);
  const und = page.getByRole('button', { name: 'Понятно' }); 
  await page.getByText('Мариам Петросян').first().click(); await page.waitForTimeout(500); if (await und.count()) await und.click();
  await page.getByRole('button', { name: /Продолжить/ }).first().click(); await page.waitForTimeout(1000);
  const near = page.getByRole('button', { name: 'Перейти к ближайшей дате' }); if (await near.count()) { await near.click(); await page.waitForTimeout(900); }
  await page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first().click(); await page.waitForTimeout(500);
  const c = page.getByRole('button', { name: /Продолжить/ }); if (await c.count()) { await c.first().click(); await page.waitForTimeout(1200); }
  t = await T(6000); console.log('details step prices:', (t.match(/\d[\d  ]*֏/g) || []), '| has Итого', t.includes('Итого'));
  await shot(page, 'O6-details-hidden-price');
});
await step('unsaved-leave', async () => {
  await as(page, 'owner', '/biz/online'); await go(page, linkHref);
  const inp = page.locator('main input').first(); console.log('first input', await inp.getAttribute('type'));
  await inp.fill('Описание C3 несохранённое'); await page.waitForTimeout(300);
  await page.locator('a[href="/biz/journal"]').first().click(); await page.waitForTimeout(1500);
  const u = page.url(); await go(page, linkHref); console.log('description after return:', await page.locator('main input').first().inputValue()); await go(page, '/biz/journal');
  console.log('url after nav', u, page.url(), 'dialog', await page.locator('[role=dialog],[role=alertdialog]').count(), (await page.locator('[role=dialog],[role=alertdialog]').last().innerText().catch(()=>'')).replace(/\n/g,' | ').slice(0, 200));
});
await stop();
