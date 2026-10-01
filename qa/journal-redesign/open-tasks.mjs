// Что внутри каждой длинной задачи (>30 мс) при открытии окна записи, CPU×4: включительное время функций.
//   node qa/journal-redesign/open-tasks.mjs [base] [n=1]
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const base = process.argv[2] ?? 'http://localhost:3710';
const n = Number(process.argv[3] ?? 1);
const INTEREST = / (src_|node_modules_%40tanstack|node_modules_1x7xaj3|node_modules_00u|node_modules_framer|node_modules_motion)|^(performSyncWorkOnRoot|renderRootConcurrent|commitRoot|flushPassiveEffects|forceLayout) /;
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
    let t = profile.startTime;
    const samples = profile.samples.map((id, k) => { t += profile.timeDeltas[k]; return { id, t, dt: (profile.timeDeltas[k + 1] ?? 0) / 1000 }; });
    const idle = (s) => /^\((idle)\)/.test(key(byId.get(s.id)));
    // busy windows: consecutive non-idle samples, gaps < 2ms
    const wins = [];
    let cur = null;
    for (const s of samples) {
      if (idle(s)) { if (cur && s.t - cur.end > 400) { wins.push(cur); cur = null; } continue; }
      if (!cur) cur = { start: s.t, end: s.t, samples: [] };
      cur.end = s.t + s.dt * 1000; cur.samples.push(s);
    }
    if (cur) wins.push(cur);
    const t0 = profile.startTime;
    console.log(`\n=== opening ${i + 1}`);
    for (const w of wins.filter((w) => (w.end - w.start) / 1000 > 25)) {
      const inc = new Map();
      const selfm = new Map();
      for (const s of w.samples) {
        const lk = key(byId.get(s.id)); selfm.set(lk, (selfm.get(lk) ?? 0) + s.dt);
        const seen = new Set();
        for (let c = s.id; c; c = parent.get(c)) { const kk = key(byId.get(c)); if (seen.has(kk)) continue; seen.add(kk); inc.set(kk, (inc.get(kk) ?? 0) + s.dt); }
      }
      console.log(`-- task @${Math.round((w.start - t0) / 1000)}ms, ${Math.round((w.end - w.start) / 1000)}ms`);
      [...inc.entries()].filter(([k]) => INTEREST.test(k) && !/^\((program|root|garbage)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 22)
        .forEach(([k, v]) => console.log(v.toFixed(1).padStart(7), k.slice(0, 110)));
      console.log('   self:', [...selfm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k.split(' ')[0]}(${k.split(' ')[1]?.slice(0, 30)})=${v.toFixed(1)}`).join('  '));
    }
  }
} finally { await browser.close(); release(); }
