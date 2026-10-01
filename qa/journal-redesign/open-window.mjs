// Открытие окна записи (DESIGN.md → Performance): CPU×4, 1600×900, 5 открытий карточки.
//   node qa/journal-redesign/open-window.mjs [base=http://localhost:3710] [runs=5]
// Два прохода: (1) кадры requestAnimationFrame без счётчика React (счётчик сам стоит времени),
// (2) коммиты и отрисованные компоненты через __REACT_DEVTOOLS_GLOBAL_HOOK__ (как scripts/renders.mjs).
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const base = process.argv[2] ?? 'http://localhost:3710';
const runs = Number(process.argv[3] ?? 5);
const url = `${base}/biz/journal?demo=owner&sphere=nails&lang=ru`;
const src = fs.readFileSync(new URL('../../scripts/renders.mjs', import.meta.url), 'utf8');
const HOOK = src.slice(src.indexOf('String.raw`') + 11, src.indexOf('})();`;') + 5);

const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function pass(browser, withHook) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  if (withHook) await ctx.addInitScript(HOOK);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 90000 });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(1500);
  // Прогрев: первое открытие грузит чанки (не мерим)
  await page.locator('[data-testid="booking-block"]').first().click();
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const out = [];
  for (let i = 0; i < runs; i++) {
    await page.evaluate((w) => {
      window.__frames = [];
      window.__stopLoop = false;
      const loop = (t) => { window.__frames.push(t); if (!window.__stopLoop) requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      if (w) window.__rr.start();
    }, withHook);
    await page.waitForTimeout(100);
    await page.locator('[data-testid="booking-block"]').nth((i * 3) % 10).click();
    await page.waitForTimeout(1200);
    const r = await page.evaluate((w) => {
      window.__stopLoop = true;
      const fr = window.__frames;
      const d = fr.slice(1).map((x, i) => x - fr[i]);
      const res = { maxFrame: +Math.max(...d).toFixed(1), over32: d.filter((x) => x > 32).length };
      if (w) {
        const s = window.__rr.stop();
        res.commits = s.commits; res.renders = s.renders;
        res.top = Object.entries(s.names).sort((a, b) => b[1] - a[1]).slice(0, 12);
      }
      return res;
    }, withHook);
    out.push(r);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await ctx.close();
  return { out, errors };
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const f = await pass(browser, false);
  const h = await pass(browser, true);
  const frames = f.out.map((r) => r.maxFrame);
  const summary = {
    maxFrame: { median: med(frames), max: Math.max(...frames), all: frames },
    over32: f.out.map((r) => r.over32),
    commits: { median: med(h.out.map((r) => r.commits)), all: h.out.map((r) => r.commits) },
    renders: { median: med(h.out.map((r) => r.renders)), all: h.out.map((r) => r.renders) },
    topComponents: h.out[0]?.top,
    errors: [...f.errors, ...h.errors].slice(0, 5),
  };
  console.log(JSON.stringify(summary, null, 1));
} finally {
  await browser.close();
  release();
}
