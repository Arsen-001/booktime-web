import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const DATE='2026-10-13';
const { page } = await open('owner', `/biz/journal?new=1&staff=st_nuri_ani&start=13:00&date=${DATE}`, { device: 'desktop' });
let d = await db(page); const ids0 = new Set(d.core.bookings.map(b=>b.id));
const win = page.locator('[role=dialog]').last();
await win.getByRole('button', { name: /Маникюр классический\s*5 000/ }).first().click(); await page.waitForTimeout(600);
const nums = win.locator('input[type=number]'); console.log('number inputs', await nums.count(), await nums.evaluateAll(e=>e.map(x=>x.name+'|'+x.getAttribute('aria-label')+'|'+x.value)));
// find discount input by label
const disc = win.getByLabel(/Скидка/).first(); console.log('disc', await disc.count());
await disc.fill('10'); await page.waitForTimeout(600);
const t = (await win.innerText()); const k=t.indexOf('К оплате'); console.log('К оплате', JSON.stringify(t.slice(k,k+30)), 'nums', await nums.evaluateAll(e=>e.map(x=>x.value)));
await win.getByPlaceholder('91 234 567').fill('77001199'); await win.getByPlaceholder('Имя').fill('Скидка Тест'); await page.waitForTimeout(300);
const save = win.getByRole('button', { name: /Записать|Создавать записи|Сохранить/ }).last(); console.log('save btn', await save.innerText());
await save.click(); await page.waitForTimeout(2000); console.log('toasts', await toasts(page));
d = await db(page); const nb = d.core.bookings.filter(b=>!ids0.has(b.id)); console.log('new', JSON.stringify(nb.map(b=>({id:b.id,start:b.start,total:b.total,svc:b.services,st:b.status,client:b.clientId}))));
const cl = nb[0] && d.core.clients.find(c=>c.id===nb[0].clientId); console.log('client', cl?.name, cl?.phone);
// reopen and change status to Клиент подтвердил, save, reload
await as(page, 'owner', `/biz/journal?date=${DATE}`);
await page.locator('[data-testid="booking-block"]', { hasText: '13:00' }).first().click(); await page.waitForTimeout(1500);
const w2 = page.locator('[role=dialog]').last();
{const t=await w2.innerText(); const k=t.indexOf('К оплате'); console.log('reopen', JSON.stringify(t.slice(k,k+30)), JSON.stringify(t.slice(0,120)));}
await w2.getByRole('button', { name: 'Клиент подтвердил' }).click(); await page.waitForTimeout(300);
await w2.getByRole('button', { name: 'Сохранить изменения' }).click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
await as(page, 'owner', `/biz/journal?date=${DATE}`);
d = await db(page); console.log('status after reload', d.core.bookings.find(b=>b.id===nb[0].id)?.status);
await shot(page, 'j7-after');
await stop();
