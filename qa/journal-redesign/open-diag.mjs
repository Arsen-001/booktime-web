// Диагностика одного открытия окна записи: длинные задачи, коммиты React (время рендера, кто рендерился), кадры.
//   node qa/journal-redesign/open-diag.mjs [base] [n=3]
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const base = process.argv[2] ?? 'http://localhost:3710';
const n = Number(process.argv[3] ?? 3);
const HOOK = String.raw`(() => {
  const TAGS = new Set([0, 1, 11, 14, 15]); const SELF = new Set(['BookingWindow','JournalScreen','DayGrid','Sheet','LeftZone','CenterZone','ClientZone','Tabs','ServicePicker','PaymentSheet']); const WATCH = new Set((window.__WATCH || 'DayGrid,BookingWindow,Sheet,LeftZone,CenterZone,ClientZone,Tabs,AttentionPanel,JournalScreen').split(','));
  const S = { rec: false, commits: [] };
  window.__d = S;
  const nameOf = (f) => { const t = f.type; if (!t) return '?'; if (typeof t === 'function') return t.displayName || t.name || 'Anon';
    if (t.render) return t.render.displayName || t.render.name || 'FR'; if (t.type) return t.type.displayName || t.type.name || 'Memo'; return String(t); };
  const walk = (root) => { const names = {}; let count = 0; const tops = [];
    const stack = [[root.current, root.current.alternate, 0, '']];
    while (stack.length) { const [nf, pf, depthTop, anc] = stack.pop();
      let top = depthTop; let a2 = anc;
      if (TAGS.has(nf.tag) && (!pf || (nf.flags & 1))) { count++; const nm = nameOf(nf); names[nm] = (names[nm] || 0) + 1;
        if (SELF.has(nm)) (S.self ||= []).push(nm + ' self=' + (nf.selfBaseDuration || 0).toFixed(1));
        if (pf && WATCH.has(nm)) { const a = nf.memoizedProps || {}, b = pf.memoizedProps || {}; const ch = Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
          (S.why ||= []).push(nm + ' changed: ' + (ch.join(',') || '(none: state/context)')); }
        if (anc === 'BookingWindow' || anc === 'CenterZone' || anc === 'LeftZone' || anc === 'ClientZone') tops.push(anc + '>' + nm + (pf ? '' : '+') + ':' + Math.round(nf.actualDuration || 0));
        a2 = nm; top = 1; }
      if (pf && nf.child === pf.child) continue;
      for (let c = nf.child; c; c = c.sibling) stack.push([c, pf ? c.alternate : null, top, a2]); }
    return { count, names, tops }; };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { renderers: new Map(), supportsFiber: true, isDisabled: false,
    inject(r) { const id = this.renderers.size + 1; this.renderers.set(id, r); return id; },
    checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) { if (!S.rec) return; const t = performance.now();
      try { const w = walk(root); S.commits.push({ self: (S.self || []).splice(0), why: (S.why || []).splice(0), t: Math.round(t), dur: Math.round(root.current.actualDuration || 0), count: w.count, tops: w.tops.slice(0, 40),
        top: Object.entries(w.names).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ':' + v).join(' ') }); } catch (e) { S.err = String(e); } } };
  new PerformanceObserver((l) => { if (S.rec) for (const e of l.getEntries()) (S.long ||= []).push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: false });
})();`;
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(HOOK);
  const page = await ctx.newPage();
  await page.goto(`${base}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="booking-block"]').first().click();
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => { const S = window.__d; S.commits = []; S.long = []; S.rec = true; S.t0 = performance.now();
      window.__fr = []; window.__stop = false; const loop = (t) => { window.__fr.push(t); if (!window.__stop) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    await page.waitForTimeout(100);
    await page.evaluate(() => (window.__d.click = Math.round(performance.now())));
    await page.locator('[data-testid="booking-block"]').nth(3 + i * 3).click();
    await page.waitForTimeout(1300);
    const r = await page.evaluate(() => { const S = window.__d; S.rec = false; window.__stop = true;
      const fr = window.__fr; const long = []; for (let k = 1; k < fr.length; k++) if (fr[k] - fr[k - 1] > 32) long.push([Math.round(fr[k - 1]), Math.round(fr[k] - fr[k - 1])]);
      return { click: S.click, longFrames: long, longTasks: S.long, commits: S.commits }; });
    const rel = (x) => x - r.click;
    console.log(`\n=== opening ${i + 1}`);
    console.log('long frames (start rel click, dur):', r.longFrames.map(([s, d]) => `${rel(s)}+${d}`).join('  '));
    console.log('long tasks:', (r.longTasks || []).map((e) => `${rel(e.t)}+${e.d}`).join('  '));
    for (const c of r.commits) { console.log(`  commit @${rel(c.t)} render=${c.dur}ms comps=${c.count} | ${c.tops.join(', ')} | ${c.top}`); if (c.why.length) console.log('     why: ' + c.why.join(' ; ')); if (c.self.length) console.log('     self: ' + c.self.join(', ')); }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
} finally { await browser.close(); release(); }
