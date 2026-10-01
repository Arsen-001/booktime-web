// CPU-профиль открытий окна записи (CPU×4): ВКЛЮЧИТЕЛЬНОЕ время функций нашего кода (src_*) и библиотек.
//   node qa/journal-redesign/open-profile.mjs [base] [n=3]
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const base = process.argv[2] ?? 'http://localhost:3710';
const n = Number(process.argv[3] ?? 3);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="booking-block"]').first().click();
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  const inc = new Map();
  const self = new Map();
  const jsxBy = new Map();
  for (let i = 0; i < n; i++) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Profiler.start');
    await page.locator('[data-testid="booking-block"]').nth(3 + i * 3).click();
    await page.waitForTimeout(1300);
    const { profile } = await cdp.send('Profiler.stop');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
    const parent = new Map();
    for (const nd of profile.nodes) for (const c of nd.children ?? []) parent.set(c, nd.id);
    const key = (nd) => `${nd.callFrame.functionName || '(anon)'} ${nd.callFrame.url.split('/').pop()}:${nd.callFrame.lineNumber}`;
    profile.samples.forEach((id, k) => {
      const dt = (profile.timeDeltas[k + 1] ?? 0) / 1000 / n;
      const seen = new Set();
      let cur = id;
      const leaf = byId.get(id);
      self.set(key(leaf), (self.get(key(leaf)) ?? 0) + dt);
      if (/^(exports\.jsx|exports\.createElement|ReactElement)/.test(key(leaf))) {
        // кто создаёт элементы: ближайшая функция нашего кода вверх по стеку
        let up = parent.get(id);
        while (up && !/ src_/.test(key(byId.get(up)))) up = parent.get(up);
        const who = up ? key(byId.get(up)) : '(no src)';
        jsxBy.set(who, (jsxBy.get(who) ?? 0) + dt);
      }
      while (cur) {
        const nd = byId.get(cur);
        const kk = key(nd);
        if (!seen.has(kk)) { seen.add(kk); inc.set(kk, (inc.get(kk) ?? 0) + dt); }
        cur = parent.get(cur);
      }
    });
  }
  const show = (m, filt, lim) => [...m.entries()].filter(([k]) => filt(k)).sort((a, b) => b[1] - a[1]).slice(0, lim).forEach(([k, v]) => console.log(v.toFixed(1).padStart(8), 'ms', k));
  console.log('--- inclusive, our code (src_*) per opening');
  show(inc, (k) => / src_/.test(k), 45);
  console.log('--- element creation (jsx/createElement self time) by nearest src caller');
  show(jsxBy, () => true, 30);
  console.log('--- self, top');
  show(self, (k) => !/^\((idle|program)\)/.test(k), 25);
} finally { await browser.close(); release(); }
