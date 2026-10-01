import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/demand', { device: 'desktop' });
const d = await db(page); const e = d.areas.platform.demandEntries; console.log('sample', JSON.stringify(e[0]));
const t = await text(page); console.log('UI', t.match(/Искали, человек\n\d+/)?.[0]?.replace('\n',' '), t.match(/Запросов без предложения\n\d+/)?.[0]?.replace('\n',' '));
const weekAgo = '2026-09-18'; const wk = e.filter(x=>(x.at||x.date||x.createdAt||'').slice(0,10) > weekAgo && (x.at||x.date||x.createdAt||'').slice(0,10) <= '2026-09-25');
console.log('week entries', wk.length, 'noOffer', wk.filter(x=>x.hadResults===false || x.resultsCount===0 || x.noOffer).length, 'unique people', new Set(wk.map(x=>x.userKey||x.appUserId||x.personId||x.phone)).size);
await stop();
