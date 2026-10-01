import { start, stop, open, go, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/clients/loyalty');
const T = async (n=1200) => (await text(page)).slice(0, n);
const inputs = page.locator('main input');
console.log('inputs', await inputs.count(), await inputs.evaluateAll(a => a.map(x => x.placeholder + '=' + x.value)));
await page.getByRole('switch').first().click(); await page.waitForTimeout(300);
// step 2: Визитов от -> set 3, 10%
await inputs.nth(2).fill('3'); await inputs.nth(3).fill('10');
// step1: Продано от 100000 -> 5% maybe keep; print
console.log('after fill', await inputs.evaluateAll(a => a.map(x => x.placeholder + '=' + x.value)));
await page.getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(2000);
console.log('toasts', await toasts(page));
await reload(page); console.log('after reload', await page.getByRole('switch').first().getAttribute('aria-checked'), await page.locator('main input').evaluateAll(a => a.map(x => x.placeholder + '=' + x.value)));
const d = await db(page);
await go(page, '/biz/clients');
const s = page.getByPlaceholder('Имя, телефон, email или номер карты');
for (const name of ['Рипсиме Саргсян', 'Тагуи Погосян', 'Элен Зограбян', 'Анаит Гукасян']) {
  await s.fill(name); await page.waitForTimeout(1000);
  console.log(name, (await page.locator('main tbody tr').first().innerText()).replace(/\s+/g, ' '));
}
await shot(page, 'K8-after-rules');
await stop();
