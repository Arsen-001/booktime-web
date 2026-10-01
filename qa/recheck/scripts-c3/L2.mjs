import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/loyalty/certificates/lcert_biz_nuri_5');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'L2-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);

await step('cert-edit', async () => {
  await page.getByRole('button', { name: 'Изменить баланс и срок' }).click();
  await page.waitForTimeout(800);
  const dlg = page.locator('[role=dialog]').last();
  console.log('dialog:', (await dlg.innerText()).slice(0, 600));
  const inputs = dlg.locator('input');
  console.log('inputs', await inputs.count());
  for (let i = 0; i < await inputs.count(); i++) console.log(i, await inputs.nth(i).getAttribute('type'), await inputs.nth(i).inputValue(), await inputs.nth(i).getAttribute('aria-label'));
  await inputs.first().fill('5000');
  await shot(page, 'L2-cert-edit-filled');
  await dlg.getByRole('button', { name: /Сохранить/ }).click();
  await page.waitForTimeout(1200);
  console.log('toasts', await toasts(page));
  await reload(page);
  console.log('after reload:', await T(600));
  const d = await db(page); const c = d.areas.loyalty.certificates.find(x => x.id === 'lcert_biz_nuri_5'); console.log('db cert', JSON.stringify(c));
  console.log('tx for cert', JSON.stringify(d.areas.loyalty.transactions.filter(t => t.certificateId === 'lcert_biz_nuri_5')));
  await shot(page, 'L2-cert-after-reload');
});

await step('referral-report-link', async () => {
  await go(page, '/biz/loyalty/referral');
  await page.getByRole('link', { name: 'Отчёт по начислениям' }).click();
  await page.waitForTimeout(2500);
  console.log('url', page.url());
  console.log(await T(900));
  await shot(page, 'L2-referral-report');
});

await step('tx-filter-cert', async () => {
  await go(page, '/biz/loyalty/transactions');
  await pick(page, page.getByRole('combobox').first(), 'Списание с сертификата');
  await page.waitForTimeout(800);
  const rows = await page.locator('main tbody tr').count();
  console.log('rows after type=cert', rows, (await T(1500)).split('\n').filter(l => /Списание|сертиф/.test(l)).slice(0, 12));
  await shot(page, 'L2-tx-cert');
});

await step('memberships-filter', async () => {
  await go(page, '/biz/loyalty/memberships');
  const inp = page.locator('main input').first();
  await inp.fill('3'); await page.waitForTimeout(1000);
  console.log((await T(1500)).split('\n').slice(-12).join(' | '));
  await shot(page, 'L2-memb-filter3');
  await page.getByRole('button', { name: 'Операции с Excel' }).click(); await page.waitForTimeout(800);
  console.log('after excel click:', await toasts(page), (await page.locator('[role=menu],[role=dialog]').allInnerTexts()).join(' / ').slice(0,400));
  await shot(page, 'L2-memb-excel');
});

await step('auto-apply-persist', async () => {
  await go(page, '/biz/loyalty/auto-apply');
  const combos = page.getByRole('combobox');
  await pick(page, combos.nth(1), 'Каждая запись');
  await page.getByRole('switch').first().click();
  await page.getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(1200);
  console.log('toasts', await toasts(page));
  await reload(page);
  console.log('combo1 =', await combos.nth(1).innerText(), 'switch =', await page.getByRole('switch').first().getAttribute('aria-checked'));
  const d = await db(page); console.log('db autoApply', JSON.stringify(d.areas.loyalty.autoApply).slice(0, 500));
});

await step('referral-persist', async () => {
  await go(page, '/biz/loyalty/referral');
  await page.getByRole('switch').first().click();
  await page.getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(1200);
  console.log('toasts', await toasts(page));
  await reload(page);
  console.log('switch after reload =', await page.getByRole('switch').first().getAttribute('aria-checked'));
});

await step('help-ticket', async () => {
  await go(page, '/biz/loyalty');
  await page.getByRole('button', { name: 'Помогите мне настроить' }).click(); await page.waitForTimeout(1500);
  console.log('toasts', await toasts(page));
  const d = await db(page); const p = d.areas.platform; console.log('platform keys', Object.keys(p));
  const sup = Object.entries(p).filter(([k]) => /support|ticket/i.test(k)); for (const [k, v] of sup) console.log(k, Array.isArray(v) ? v.length : typeof v, JSON.stringify(Array.isArray(v) ? v.slice(-1) : v).slice(0, 400));
  await as(page, 'platform', '/platform/support');
  console.log((await T(1500)));
  await shot(page, 'L2-platform-support');
});
await stop();
