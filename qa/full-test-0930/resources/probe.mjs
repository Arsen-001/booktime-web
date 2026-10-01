import { start, stop, ctx, open, shot, area } from './lib.mjs';
await start();
try {
  const c = await ctx({ time: '2026-09-30T10:00:00+04:00' });
  const p = await open(c, '/biz/waitlist');
  await shot(p, 'probe-waitlist');
  await p.getByRole('button', { name: 'Создать заявку' }).first().click();
  await p.waitForTimeout(800);
  await shot(p, 'probe-form');
  console.log((await p.locator('[role=dialog]').innerText()).slice(0, 2000));
  const a = await area(p, 'resources');
  console.log('resources area keys', a && Object.keys(a.state ?? a));
  console.log(p.errors);
} finally { await stop(); }
