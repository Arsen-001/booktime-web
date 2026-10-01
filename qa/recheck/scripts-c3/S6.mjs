import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/schedule');
const row = () => page.locator('main tr').filter({ hasText: 'Лилит Мкртчян' }).locator('button');
const sel = async () => (await text(page)).split('\n').find(l => /Выбрано ячеек/.test(l));
await page.getByRole('button', { name: /Следующ/ }).first().click().catch(()=>{}); await page.waitForTimeout(800);
for (const mod of ['Meta', 'Control', 'Shift']) {
  await row().nth(1).click(); await page.waitForTimeout(500); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await row().nth(1).click({ modifiers: [mod] }).catch(e => console.log('err', e.message.slice(0, 80))); await page.waitForTimeout(400);
  await row().nth(3).click({ modifiers: [mod], force: true }).catch(e => console.log('err', e.message.slice(0, 80))); await page.waitForTimeout(400);
  console.log(mod, await sel(), 'dialog', await page.locator('[role=dialog]').count());
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
// save one cell edit, then check history + db
await row().nth(2).click(); await page.waitForTimeout(600);
await page.locator('[role=dialog]').last().getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(2000);
console.log('toasts', await toasts(page));
const d = await db(page); console.log('schedule area keys', Object.keys(d.areas.schedule)); for (const [k, v] of Object.entries(d.areas.schedule)) if (/hist|log|change/i.test(k)) console.log(k, Array.isArray(v) ? v.length : Object.keys(v).length, JSON.stringify(v).slice(0, 300));
await go(page, '/biz/schedule/history'); console.log('history:', (await text(page)).split('\n').slice(0, 10).join(' | '));
await as(page, 'owner', '/biz/schedule/slots'); await pick(page, page.getByRole('combobox').filter({ hasText: /Без перерыва/ }).first(), '10 мин'); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
await go(page, '/biz/schedule/history'); console.log('history2:', (await text(page)).split('\n').slice(0, 12).join(' | '));
await stop();
