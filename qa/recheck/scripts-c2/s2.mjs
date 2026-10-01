import { start, stop, open, as, reload, text, shot, db, toasts, btnTexts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/schedule/slots', { device: 'desktop' });
await page.getByRole('button', { name: 'Редактировать правила' }).click(); await page.waitForTimeout(800);
for (let i=0;i<6;i++){
  const dlg = page.locator('[role=dialog]').last();
  console.log('--- step', i, (await dlg.innerText()).replace(/\n+/g,' | ').slice(0,700));
  const bt = await dlg.locator('button').allInnerTexts(); console.log('BTN', bt.join(' / '));
  if (i===0) { await dlg.getByText('Фиксированный', {exact:false}).first().click(); await page.waitForTimeout(300); }
  if (/С каким интервалом/.test(await dlg.innerText())) { await pick(page, dlg.getByRole('combobox').first(), '1 ч'); console.log('picked', (await dlg.innerText()).match(/интервалом[^|]*\n([^\n]+)/)?.[1]); }
  const next = dlg.getByRole('button', { name: /Далее|Завершить настройку/ });
  if (!(await next.count())) break;
  const nm = await next.first().innerText(); await next.first().click(); await page.waitForTimeout(1200);
  if (/Завершить/.test(nm)) break;
}
console.log('toasts', await toasts(page));
const d = await db(page); console.log(JSON.stringify(d.areas.schedule.slotRules['location:loc_nuri']));
await as(page, 'client', '/book?staff=st_nuri_ani&service=sv_nuri_classic');
console.log('client', (await text(page)).match(/\d\d:\d\d/g));
await page.getByRole('button', { name: /пн, 28 сентября/ }).click(); await page.waitForTimeout(1000);
console.log('client mon', (await text(page)).match(/\d\d:\d\d/g));
const core = (await db(page)).core; const sc = core.schedules.filter(s=>s.staffId==='st_nuri_ani'); console.log(JSON.stringify(sc.map(s=>({loc:s.locationId, week:s.week, ov:Object.keys(s.overrides||{}).length}))));
console.log('svc', JSON.stringify(core.services.find(s=>s.id==='sv_nuri_classic')));
console.log('ani bookings 28', JSON.stringify(core.bookings.filter(b=>b.staffId==='st_nuri_ani'&&b.start.startsWith('2026-09-28')&&!b.deletedAt).map(b=>[b.start,b.durationMin,b.status])));
await stop();
