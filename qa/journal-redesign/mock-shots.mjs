// Снимки живой страницы /biz/journal для сверки с макетом A2 (задача «сделай как в макете», 27.09.2026).
//   node qa/journal-redesign/mock-shots.mjs <outPrefix>
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const prefix = process.argv[2] ?? 'qa/journal-redesign/mock';
const base = 'http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru';
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
    if (process.env.FAKE_TIME) await page.clock.setFixedTime(new Date(process.env.FAKE_TIME));
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.goto(`${base}&theme=light`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${prefix}-${s.name}.png` });
    if (errs.length) console.log(s.name, 'errors:', errs.slice(0, 5).join('\n'));
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
