import { start, stop, open, go, text, db } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/clients');
const s = page.getByPlaceholder('Имя, телефон, email или номер карты');
for (const [id, name] of [['cl_029', 'Рипсиме Саргсян'], ['cl_018', 'Элен Зограбян'], ['cl_081','Ануш Асатрян']]) {
  await go(page, '/biz/clients'); await s.fill(name); await page.waitForTimeout(1200);
  const row = (await page.locator('main tbody tr').first().innerText()).replace(/\s+/g, ' ');
  await go(page, '/biz/clients/' + id); const t = (await text(page)).split('\n'); const i = t.indexOf('Визиты');
  await go(page, `/biz/journal?new=1&client=${id}`); await page.waitForTimeout(800); await page.getByRole('tab', { name: 'Клиент' }).click().catch(()=>{}); await page.waitForTimeout(800);
  const w = (await page.locator('[role=dialog]').last().innerText()).split('\n').filter(Boolean); const j = w.indexOf('Визитов');
  console.log(id, '\n  list:', row, '\n  card:', t.slice(i, i + 8).join(' | '), '\n  window:', w.slice(j - 1, j + 6).join(' | '));
}
await stop();
