import { start, stop, page, shot, step, BASE } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
try {
  const p = await page({ time: '2026-09-30T12:20:00+04:00' });
  await p.waitForTimeout(3000);
  const list = JSON.parse(await p.evaluate(() => localStorage.getItem('bp-mock-db:core:bookings') ?? 'null')) ;
  log('stored bookings key', Boolean(list));
  await step('records filter', async () => {
    await p.goto(BASE + '/biz/records').catch(() => {}); await p.waitForTimeout(8000);
    const count = async () => (await p.locator('main').innerText()).match(/Показано\s*\n?\s*([\d  ]+)/)?.[1]?.trim();
    log('all:', await count());
    for (const lbl of ['Не отменённые', 'Отменённые', 'Удалённые']) {
      await p.evaluate((l) => { const b = [...document.querySelectorAll('[role=radio]')].find((x) => x.textContent.trim() === l); if (!b) throw new Error('no radio ' + l + ': ' + [...document.querySelectorAll('[role=radio]')].map((x) => x.textContent.trim()).join('|')); b.click(); }, lbl);
      await p.waitForTimeout(2500);
      const m = await p.locator('main').innerText();
      const st = (m.match(/Отменил (клиент|мастер)/g) ?? []).length;
      log(lbl, 'shown:', await count(), 'rows with Отменил*:', st, '| Записан:', (m.match(/\tЗаписан\t|Записан/g) ?? []).length);
      await shot(p, `s12-records-${lbl}`);
    }
  });
  log('errors', p.errors.filter((e) => !/Hydration/.test(e)).slice(0, 5));
} finally { await stop(); }
