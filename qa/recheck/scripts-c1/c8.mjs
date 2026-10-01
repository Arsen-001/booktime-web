import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('guest', '/search', { device: 'desktop' });
const cnt = async () => (await text(page)).match(/Найден[оа]? \d+ мастер\S*/)?.[0];
log('initial', await cnt());
const input = page.getByPlaceholder('Что ищете?').first();
await input.fill('ногти'); await input.press('Enter'); await page.waitForTimeout(2500);
const t1 = await text(page);
log('ногти', await cnt());
// collect business names in results
log(t1.slice(t1.indexOf('Найден'), t1.indexOf('Найден') + 1500));
await page.getByRole('button', { name: 'Свободно сегодня' }).or(page.getByText('Свободно сегодня', { exact: true })).first().click(); await page.waitForTimeout(2500);
const t2 = await text(page);
log('ногти + today', await cnt());
log(t2.slice(t2.indexOf('Найден'), t2.indexOf('Найден') + 1500));
await input.fill('zzqxw'); await input.press('Enter'); await page.waitForTimeout(2500);
log('--- empty\n', (await text(page)).slice(0, 800));
// compute expected via db: nails staff active with services...
const d = await db(page);
const nails = d.core.staff.filter(s => s.status==='active' && s.sphereIds.includes('nails') && s.calendarVisibility !== 'mine');
log('nails staff in db', nails.map(s=>s.name+':'+s.businessId).join(', '));
// regulars for ani
const per = {}; for (const b of d.core.bookings) { if (b.deletedAt||!b.clientId) continue; if (b.staffId!=='st_nuri_ani' && !b.services.some(s=>s.staffId==='st_nuri_ani')) continue; if (/cancelled/.test(b.status)) continue; per[b.clientId]=(per[b.clientId]||0)+1; }
log('ani regulars (>=3, incl future)', Object.values(per).filter(n=>n>=3).length, 'visits-arrived-only:', (()=>{const p={}; for (const b of d.core.bookings){ if(b.staffId!=='st_nuri_ani'||b.status!=='arrived'||!b.clientId) continue; p[b.clientId]=(p[b.clientId]||0)+1;} return Object.values(p).filter(n=>n>=3).length;})());
log('ERR', page.errors.slice(0,3));
await stop();
