import { start, stop, page, shot } from './lib.mjs';
await start();
try {
  const p = await page({ time: '2026-09-30T12:20:00+04:00' });
  console.log('url', p.url());
  await shot(p, 's1-desktop-1220');
  const now = p.locator('[aria-label="Что происходит сейчас"]');
  console.log('DayNow:', await now.count() ? await now.innerText() : 'NONE');
  const aside = p.locator('aside').last();
  console.log('ATTN:', (await p.locator('text=Требует внимания').count()));
  console.log(await p.evaluate(() => document.body.innerText.slice(0, 3000)));
  console.log('errors', p.errors);
} finally { await stop(); }
