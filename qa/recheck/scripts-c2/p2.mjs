import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', '/places/biz_atam', { device: 'desktop' });
let d = await db(page);
console.log('core svc', JSON.stringify(d.core.services.filter(s=>s.businessId==='biz_atam').map(s=>[s.id, s.name.ru, s.priceMin, s.moderation ?? s.status ?? s.active])));
const has = async () => { const t = await text(page); return { plain: /Отбеливание зубов(?! ZOOM)/.test(t), any: (t.match(/Отбеливание[^\n]*/g)||[]) }; };
console.log('client before', JSON.stringify(await has()));
await as(page, 'client', '/b/atam-dental'); console.log('web before', JSON.stringify(await has()));
await as(page, 'platform', '/platform/moderation');
console.log('PLAT', (await text(page)).slice(0,300).replace(/\n/g,' | ')); const row = page.locator('tr, li, div').filter({ hasText: 'Новая услуга: Отбеливание зубов' }).filter({ has: page.getByRole('button', { name: 'Одобрить' }) }).last(); await row.getByRole('button', { name: 'Одобрить' }).click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
await reload(page); console.log('tabs', (await text(page)).match(/На проверке\n\d+\nОдобрено\n\d+/)?.[0]?.replace(/\n/g,' '));
d = await db(page); console.log('mod_3', JSON.stringify(d.areas.platform.moderationItems.find(m=>m.id==='mod_3')).slice(0,200), 'core svc after', d.core.services.filter(s=>s.businessId==='biz_atam').length);
await as(page, 'client', '/places/biz_atam'); console.log('client after', JSON.stringify(await has()));
await as(page, 'client', '/masters/st_atam_seda'); console.log('seda after', JSON.stringify(await has()));
// story template in pending?
const tpl = d.areas.platform.moderationItems.filter(m=>m.kind==='story').map(m=>[m.id,m.refId,m.source,m.status]); console.log('stories', JSON.stringify(tpl));
await stop();
