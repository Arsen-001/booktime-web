import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const box = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="booking-block"]'));
    for (const c of cards) {
      const next = c.parentElement?.nextElementSibling;
      if (next && next.getAttribute('aria-label') && next.getAttribute('aria-label').toLowerCase().includes('перерыв')) {
        const r = c.parentElement.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height + 40 };
      }
    }
    return null;
  });
  console.log('box', box);
  if (box) {
    await page.screenshot({ path: 'qa/journal-redesign/break-zoom.png', clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 10), width: box.w + 40, height: box.h + 20 } });
  } else {
    await page.screenshot({ path: 'qa/journal-redesign/break-zoom-full.png' });
  }
} finally {
  await browser.close();
  release();
}
