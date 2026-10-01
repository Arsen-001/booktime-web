import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const base = 'http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (process.env.FAKE_TIME) await page.clock.setFixedTime(new Date(process.env.FAKE_TIME));
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(2000);
  // Достаём реальные часы работы и диапазон сетки из React fiber пропсов DayGrid
  const info = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="booking-block"]');
    let f = null;
    if (el) {
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
      f = el[key];
      while (f && !(f.memoizedProps && f.memoizedProps.bookingsByColumn && f.memoizedProps.columns)) f = f.return;
    }
    if (!f) return { error: 'no fiber found' };
    const { columns } = f.memoizedProps;
    return columns.map((c) => (c.kind === 'staff' ? { id: c.id, name: c.staff.name, hours: c.hours } : { id: c.id, kind: 'resource' }));
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'qa/journal-redesign/crop-top.png', clip: { x: 100, y: 190, width: 1000, height: 260 } });
} finally {
  await browser.close();
  release();
}
