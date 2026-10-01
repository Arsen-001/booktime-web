import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/clients', { device: 'desktop' });
const heads = async () => (await page.locator('thead th').allInnerTexts()).map(s=>s.trim()).filter(Boolean);
log('heads', await heads());
// columns menu
await page.getByRole('button', { name: 'Колонки' }).click(); await page.waitForTimeout(800);
await page.getByRole('checkbox', { name: 'Email' }).click().catch(async()=>{ await page.getByText('Email', {exact:true}).last().click(); }); await page.waitForTimeout(1000);
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
log('after hide Email', await heads());
await page.reload(); await settle(page);
log('after reload', await heads());
// pin 5
await page.getByRole('button', { name: 'Колонки' }).click(); await page.waitForTimeout(800);
for (const c of ['Телефон','Продано','Визиты','Скидка','Баланс счета','Последний визит']) {
  const b = page.getByRole('button', { name: `Закрепить «${c}»` });
  if (await b.count()) { await b.click(); await page.waitForTimeout(700); log('pin', c, await toast(page)); }
  else log('no pin btn for', c);
}
await page.keyboard.press('Escape');
await page.reload(); await settle(page);
await page.getByRole('button', { name: 'Колонки' }).click(); await page.waitForTimeout(800);
log('unpin buttons after reload', await page.getByRole('button', { name: /^Открепить/ }).count());
await page.keyboard.press('Escape');
// restore email visibility
await page.getByRole('button', { name: 'Колонки' }).click(); await page.waitForTimeout(500);
await page.getByRole('checkbox', { name: 'Email' }).click().catch(()=>{}); await page.keyboard.press('Escape');
// select 2 rows, export via Действия
const cbs = page.locator('tbody tr input[type=checkbox], tbody tr [role=checkbox]');
log('row checkboxes', await cbs.count());
await cbs.nth(0).click(); await cbs.nth(2).click(); await page.waitForTimeout(500);
await page.getByRole('button', { name: /Действия/ }).click(); await page.waitForTimeout(700);
log('menu', (await page.locator('[role=menu]').allInnerTexts()).join(' | '));
await page.getByRole('menuitem', { name: /Выгрузить/ }).first().click(); await page.waitForTimeout(1500);
log('export toast', await toast(page));
// gold filter
await page.getByRole('button', { name: /^Фильтры/ }).click(); await page.waitForTimeout(1000);
const sheet = page.locator('[role=dialog]').last();
await sheet.getByText('По клиентам').click().catch(()=>{}); await page.waitForTimeout(500);
const gold = sheet.getByText('Золото', { exact: true });
log('gold opts', await gold.count());
await gold.first().click(); await sheet.getByRole('button', { name: 'Найти' }).click(); await page.waitForTimeout(1500);
const names = (await page.locator('tbody tr').allInnerTexts()).map(r=>r.split('\t').map(s=>s.trim()).filter(Boolean)[0]);
log('gold rows', names, (await text(page)).match(/\d+–\d+ из \d+/)?.[0]);
const d = await db(page);
const nuri = d.core.clients.filter(c=>c.businessId==='biz_nuri');
const goldExp = nuri.filter(c=>d.areas.clients.profiles[c.id]?.importanceClass==='gold').map(c=>c.name);
log('expected gold', goldExp.length, goldExp);
log('ERR', page.errors.slice(0,3));
await stop();
