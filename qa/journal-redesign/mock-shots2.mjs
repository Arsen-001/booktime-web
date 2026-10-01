import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const prefix = process.argv[2] ?? 'docs/design/after/journal-mock';
const base = 'http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light';
const shots = [
  { name: '1440', w: 1440, h: 900 },
  { name: '1280', w: 1280, h: 800 },
  { name: '390', w: 390, h: 844, mobile: true },
];
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, isMobile: !!s.mobile, hasTouch: !!s.mobile });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${prefix}-${s.name}.png` });
    console.log(s.name, 'errors:', errs.slice(0, 8).join(' | ') || 'none');
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
