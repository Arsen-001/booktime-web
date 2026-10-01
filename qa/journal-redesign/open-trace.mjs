// Трасса Chrome (devtools.timeline) открытия окна записи, CPU×4: из чего состоят задачи главного потока >25 мс.
//   node qa/journal-redesign/open-trace.mjs [base] [n=2]
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const base = process.argv[2] ?? 'http://localhost:3710';
const n = Number(process.argv[3] ?? 2);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 90000 });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="booking-block"]').first().click();
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  const cdp = await ctx.newCDPSession(page);
  for (let i = 0; i < n; i++) {
    const events = [];
    cdp.on('Tracing.dataCollected', (e) => events.push(...e.value));
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
    await page.evaluate(() => { window.__fr = []; window.__stop = false; const loop = (t) => { window.__fr.push(performance.timeOrigin + t); if (!window.__stop) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    await page.waitForTimeout(60);
    await page.locator('[data-testid="booking-block"]').nth(3 + i * 3).click();
    await page.waitForTimeout(1300);
    const frames = await page.evaluate(() => { window.__stop = true; return window.__fr; });
    await cdp.send('Tracing.end');
    await done;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const main = events.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain' && events.some((x) => x.pid === e.pid && x.name === 'RunTask'));
    const tid = main?.tid, pid = main?.pid;
    const mine = events.filter((e) => e.pid === pid && e.tid === tid && e.ph === 'X');
    const tasks = mine.filter((e) => e.name === 'RunTask' && e.dur > 25000).sort((a, b) => a.ts - b.ts);
    const start = tasks[0]?.ts ?? 0;
    console.log(`\n=== opening ${i + 1}: tasks > 25ms: ${tasks.length}`);
    const KIND = { FunctionCall: 'js', EvaluateScript: 'js', TimerFire: 'js', FireAnimationFrame: 'js', EventDispatch: 'js', 'v8.callFunction': 'js', RunMicrotasks: 'js',
      UpdateLayoutTree: 'style', Layout: 'layout', Paint: 'paint', PrePaint: 'paint', Layerize: 'paint', 'Commit': 'paint', UpdateLayer: 'paint', HitTest: 'hittest', ParseHTML: 'parse' };
    for (const t of tasks) {
      const inner = mine.filter((e) => e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t);
      const agg = {};
      // верхнеуровневые куски: только события, не вложенные в другие из списка
      const top = inner.filter((e) => KIND[e.name]).filter((e) => !inner.some((o) => o !== e && KIND[o.name] && o.ts <= e.ts && o.ts + o.dur >= e.ts + e.dur && o.dur > e.dur));
      for (const e of top) agg[e.name] = (agg[e.name] ?? 0) + e.dur / 1000;
      const names = inner.filter((e) => e.name === 'FunctionCall' || e.name === 'TimerFire' || e.name === 'FireAnimationFrame' || e.name === 'EventDispatch').map((e) => (e.args?.data?.type || e.args?.data?.functionName || e.name)).slice(0, 6);
      console.log(`  @${Math.round((t.ts - start) / 1000)} ${Math.round(t.dur / 1000)}ms  ` + Object.entries(agg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v.toFixed(0)}`).join(' ') + '  | ' + names.join(','));
    }
    // Длинные кадры rAF и что шло внутри них (события трассы >2 мс верхнего уровня, в т.ч. без JS)
    const clock = events.find((e) => e.name === 'TimeStamp' || e.name === 'FireAnimationFrame');
    const fa = mine.filter((e) => e.name === 'FireAnimationFrame').map((e) => e.ts);
    // сопоставляем часы: первый FireAnimationFrame после начала ~ первый кадр
    const off = fa.length ? fa[0] - frames[0] * 1000 : 0;
    for (let k = 1; k < frames.length; k++) {
      const gap = frames[k] - frames[k - 1];
      if (gap <= 34) continue;
      const a = frames[k - 1] * 1000 + off, b = frames[k] * 1000 + off;
      const inside = mine.filter((e) => e.ts < b && e.ts + e.dur > a && e.dur > 2000 && ['RunTask'].includes(e.name));
      const sub = mine.filter((e) => e.ts < b && e.ts + e.dur > a && e.dur > 2000 && !['RunTask', 'ThreadControllerImpl::RunTask'].includes(e.name) && !e.name.startsWith('v8.') );
      const agg = {};
      for (const e of sub) agg[e.name] = (agg[e.name] ?? 0) + Math.min(e.dur, b - e.ts, e.ts + e.dur - a) / 1000;
      console.log(`  frame @${Math.round(a / 1000 - (tasks[0]?.ts ?? a) / 1000)} gap ${gap.toFixed(0)}ms, tasks ${inside.map((e) => Math.round(e.dur / 1000)).join('+')}: ` + Object.entries(agg).sort((x, y) => y[1] - x[1]).slice(0, 7).map(([k2, v]) => `${k2}=${v.toFixed(0)}`).join(' '));
    }
    cdp.removeAllListeners('Tracing.dataCollected');
  }
} finally { await browser.close(); release(); }
