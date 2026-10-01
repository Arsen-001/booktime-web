import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
for (const persona of ['client','guest','client','guest']) {
  const { page, context } = await open(persona, '/', { device: 'phone' });
  const a = await text(page);
  const s1 = { upcoming: /Ближайшие записи/.test(a), empty: /никто не свободен/.test(a), masters: (a.match(/Сегодня, /g)||[]).length };
  await page.waitForTimeout(6000);
  const b = await text(page);
  const s2 = { upcoming: /Ближайшие записи/.test(b), empty: /никто не свободен/.test(b), masters: (b.match(/Сегодня, /g)||[]).length };
  log(persona, 'settled:', JSON.stringify(s1), '+6s:', JSON.stringify(s2));
  if (s2.empty) await shot(page, 'c7-empty-'+persona);
  await context.close();
}
await stop();
