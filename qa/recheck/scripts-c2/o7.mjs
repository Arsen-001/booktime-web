import { start, stop, open, as, reload, text, shot, db, toasts, wizardToDetails } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online/page', { device: 'desktop' });
const inp = page.locator('div').filter({ hasText: 'Материалы и бренды, с которыми работаю' }).locator('input[type=text]').last(); console.log('existing', (await page.locator('div').filter({ hasText: 'Материалы и бренды, с которыми работаю' }).last().innerText()).replace(/\n/g,' | ').slice(0,200)); await inp.fill('OPI'); await inp.press('Enter'); await inp.fill('Kodi'); await inp.press('Enter'); await page.waitForTimeout(400);
const sec = page.locator('section, div').filter({ hasText: 'Материалы и бренды, с которыми работаю' }).filter({ has: page.getByRole('button', { name: 'Сохранить' }) }).last();
await sec.getByRole('button', { name: 'Сохранить' }).last().click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
await reload(page); const pt = await text(page); const i = pt.indexOf('Материалы и бренды'); console.log('after reload', pt.slice(i, i+120).replace(/\n/g,' | '));
for (const r of ['/b/nuri-nail-studio', '/b/nuri-nail-studio/about']) { await as(page, 'guest', r); const t = await page.locator('body').innerText(); console.log(r, 'OPI', t.includes('OPI'), 'Kodi', t.includes('Kodi')); }
await as(page, 'client', '/places/biz_nuri'); { const t = await text(page); console.log('app place OPI', t.includes('OPI')); }
// subdomain taken by another business?
let d = await db(page); console.log('links subdomains', JSON.stringify(d.areas.online.links.map(l=>[l.businessId,l.subdomain,l.domain]).filter(x=>x[1])));
await stop();
