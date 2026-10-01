// Снимки журнала для сверки с макетами (stage 2 редизайна).
//   node qa/journal-redesign/shots.mjs <outPrefix> [lang=ru]
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const prefix = process.argv[2] ?? 'qa/journal-redesign/cur';
const lang = process.argv[3] ?? 'ru';
const only = process.argv[4];
const base = 'http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=' + lang;
const shots = [
  { name: '1600', w: 1600, h: 900, theme: 'light' },
  { name: '1280', w: 1280, h: 800, theme: 'light' },
  { name: '390', w: 390, h: 844, theme: 'light', mobile: true },
  { name: '1600-dark', w: 1600, h: 900, theme: 'dark' },
  { name: '390-dark', w: 390, h: 844, theme: 'dark', mobile: true },
  { name: '1440', w: 1440, h: 900, theme: 'light' },
].filter((s) => !only || only.split(',').includes(s.name));
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1, isMobile: !!s.mobile, hasTouch: !!s.mobile });
    const page = await ctx.newPage();
    // Снимки «как в макете»: 13:20 по Еревану — видна линия «сейчас» и окна после неё
    if (process.env.FAKE_TIME) await page.clock.setFixedTime(new Date(process.env.FAKE_TIME));
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.goto(`${base}&theme=${s.theme}`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${prefix}-${s.name}.png` });
    if (errs.length) console.log(s.name, 'errors:', errs.slice(0, 5).join('\n'));
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
