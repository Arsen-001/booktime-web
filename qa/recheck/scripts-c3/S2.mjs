import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('master', '/biz/schedule/calendar');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'S2-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('voice-draft', async () => {
  const inp = page.getByPlaceholder(/Мария|фраз/i).or(page.locator('main textarea')).first();
  await inp.fill('Мария, четверг, 15:00, маникюр'); await page.getByRole('button', { name: 'Разобрать' }).click(); await page.waitForTimeout(1500);
  const t = await T(6000); const i = t.indexOf('Разобрать'); console.log('after parse:', t.slice(i, i + 400).replace(/\n/g, ' | '));
  console.log('toasts', await toasts(page), 'url', page.url(), 'dialog', await page.locator('[role=dialog]').count(), 'inputs', await page.locator('main input:visible').evaluateAll(a => a.map(x => (x.placeholder||x.type) + '=' + x.value).slice(0, 8)));
  if (await page.locator('[role=dialog]').count()) console.log('dlg', (await page.locator('[role=dialog]').last().innerText()).replace(/\n/g, ' | ').slice(0, 500));
  await shot(page, 'S2-voice');
});
await step('daytype-vacation-with-bookings', async () => {
  await go(page, '/biz/schedule/calendar');
  const t = await T(20000);
  // find a day card header "четверг, 24 сентября" etc; choose Friday 25 which has bookings
  const day = page.locator('main section, main div').filter({ hasText: /^пятница, 25 сентября/ }).first();
  console.log('day card count', await day.count());
  const d0 = await db(page); const sch0 = JSON.stringify(d0.core.calendarMarks).length;
  const cards = page.getByRole('combobox').filter({ hasText: 'Рабочий день' }); console.log('daytype combos', await cards.count());
  // 5th card = Friday (Mon..)
  await pick(page, cards.nth(4), 'Отпуск'); await page.waitForTimeout(1200);
  const tt = await T(20000); const j = tt.indexOf('пятница, 25 сентября'); console.log('friday card:', tt.slice(j, j + 500).replace(/\n/g, ' | '));
  console.log('toasts', await toasts(page), 'combo now', await cards.nth(4).innerText().catch(()=>'?'));
  const allb = await page.locator('main button:visible').allInnerTexts(); console.log('buttons with save', allb.filter(b => /Сохран|Применить|Отпуск/i.test(b)));
  const sv = page.getByRole('button', { name: /Сохранить/ }); if (await sv.count()) { await sv.first().click(); await page.waitForTimeout(1500); console.log('after save toasts', await toasts(page)); }
  await reload(page); const t2 = await T(20000); const k = t2.indexOf('пятница, 25 сентября'); console.log('after reload friday:', t2.slice(k, k + 250).replace(/\n/g, ' | '));
  const d = await db(page); console.log('marks 09-25', JSON.stringify(d.core.calendarMarks.filter(m => JSON.stringify(m).includes('2026-09-25'))).slice(0, 400));
  await shot(page, 'S2-vacation-fri');
});
await step('history', async () => {
  await go(page, '/biz/schedule/history'); console.log((await T(1500)).replace(/\n/g, ' | '));
});
await stop();
