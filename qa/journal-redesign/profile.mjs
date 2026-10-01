// CPU-профиль одного открытия/закрытия окна записи (CPU×4), топ функций по собственному времени.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const base = process.argv[2] ?? 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-testid="booking-block"]').nth(i).click();
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
  }
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map();
  const dt = profile.timeDeltas;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const f = n.callFrame;
    const k = process.env.BYFILE ? f.url.split('/').pop() : `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}:${f.columnNumber}`;
    self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [k, v] of top) console.log(v.toFixed(1).padStart(8), 'ms', k);
} finally {
  await browser.close();
  release();
}
