import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('guest', '/login');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'C4-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
const loginPw = async (u, p) => {
  await as(page, 'guest', '/login');
  await page.getByRole('radio', { name: 'Мастер или бизнес' }).click(); await page.waitForTimeout(400);
  await page.getByText('Логин и пароль', { exact: true }).click(); await page.waitForTimeout(400);
  const ins = page.locator('main input:visible'); console.log('inputs', await ins.count());
  await ins.nth(0).fill(u); await ins.nth(1).fill(p);
  await page.getByRole('button', { name: /^Войти$/ }).click(); await page.waitForTimeout(1800);
};
await step('first-login', async () => {
  await loginPw('owner1', 'owner1');
  const dlg = page.locator('[role=dialog]'); console.log('dialog?', await dlg.count(), (await dlg.count()) ? (await dlg.last().innerText()).replace(/\n/g,' | ') : '', 'toasts', await toasts(page));
  if (await dlg.count()) { const pi = dlg.last().locator('input'); for (let i = 0; i < await pi.count(); i++) await pi.nth(i).fill('NewPass123'); await dlg.last().getByRole('button').last().click(); await page.waitForTimeout(3000); }
  console.log('url', page.url(), await toasts(page));
  const d = await db(page); const cand = JSON.stringify(d.areas.client).match(/.{0,120}owner1.{0,200}/g); console.log('db owner1:', cand && cand.slice(0,2));
});
await step('second-login-new-pass', async () => {
  await loginPw('owner1', 'NewPass123');
  console.log('dialog?', await page.locator('[role=dialog]').count(), 'url', page.url(), await toasts(page));
});
await step('second-login-old-pass', async () => {
  await loginPw('owner1', 'owner1');
  console.log('dialog?', await page.locator('[role=dialog]').count(), 'url', page.url(), await toasts(page), (await T(2000)).split('\n').filter(l=>/невер|Невер|ошиб|Ошиб|парол/i.test(l)).slice(0,3));
  await shot(page, 'C4-old-pass');
});
await step('register-business', async () => {
  const d0 = await db(page); const n0 = d0.core.businesses.length;
  await as(page, 'guest', '/register-business');
  console.log((await T(700)).replace(/\n/g,' | '));
  await page.getByText('Салон', { exact: false }).first().click(); await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(500);
  await page.getByText('Барбер').first().click(); await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Далее' }).click(); await page.waitForTimeout(500);
  const ins = page.locator('main input:visible'); console.log('inputs', await ins.count(), (await T(900)).split('\n').slice(-10).join(' | '));
  await ins.nth(0).fill('Салон Проверка C3'); await ins.nth(1).fill('91 555 333');
  await page.getByRole('button', { name: /Зарегистрировать/ }).click(); await page.waitForTimeout(3000);
  console.log('url', page.url(), await toasts(page));
  const dd = await db(page); console.log('found in db:', JSON.stringify(dd).match(/.{0,200}Проверка C3.{0,200}/g)); const d = dd; console.log('businesses', n0, '→', d.core.businesses.length, d.core.businesses.slice(-1).map(b => b.name + ' ' + b.id + ' ' + b.sphere));
  console.log('header:', (await page.locator('header, aside').first().innerText()).replace(/\n/g,' | ').slice(0, 300));
  await go(page, '/biz/settings'); console.log('settings:', (await T(800)).replace(/\n/g,' | '));
  await shot(page, 'C4-after-register');
});
await stop();
