import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const HOOK = String.raw`(() => {
  const PERFORMED_WORK = 1; // ReactFiberFlags.PerformedWork
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]); // Function, Class, ForwardRef, Memo, SimpleMemo
  const S = {
    recording: false, t0: 0, lastAny: 0, commits: 0, renders: 0, mounts: 0, updates: 0, dom: 0,
    first: 0, last: 0, names: {}, base: { requests: 0, queries: 0 },
    start() {
      Object.assign(this, { recording: true, t0: performance.now(), commits: 0, renders: 0, mounts: 0, updates: 0, dom: 0, first: 0, last: 0, names: {} });
      const a = window.__bpApiStats || {};
      this.base = { requests: a.requests || 0, queries: a.queries || 0 };
    },
    stop() {
      this.recording = false;
      const a = window.__bpApiStats || {};
      return {
        commits: this.commits, renders: this.renders, mounts: this.mounts, updates: this.updates, dom: this.dom,
        feedback: this.first ? Math.round(this.first - this.t0) : null,
        settled: this.last ? Math.round(this.last - this.t0) : null,
        requests: (a.requests || 0) - this.base.requests, queries: (a.queries || 0) - this.base.queries,
        names: this.names,
      };
    },
  };
  window.__rr = S;
  const nameOf = (f) => {
    const t = f.type;
    if (!t) return 'Anonymous';
    if (typeof t === 'function') return t.displayName || t.name || 'Anonymous';
    if (typeof t === 'object') {
      if (t.displayName) return t.displayName;
      if (t.render) return t.render.displayName || t.render.name || 'ForwardRef';
      if (t.type) return typeof t.type === 'function' ? t.type.displayName || t.type.name || 'Memo' : 'Memo';
    }
    return String(t);
  };
  const walk = (root) => {
    const next = root.current;
    const stack = [[next, next.alternate]];
    while (stack.length) {
      const [nf, pf] = stack.pop();
      if (COMPONENT_TAGS.has(nf.tag)) {
        const mounted = !pf;
        if (mounted || (nf.flags & PERFORMED_WORK) === PERFORMED_WORK) {
          S.renders++;
          if (mounted) S.mounts++; else S.updates++;
          const n = nameOf(nf);
          S.names[n] = (S.names[n] || 0) + 1;
        }
      }
      if (pf && nf.child === pf.child) continue; // поддерево пропущено React целиком
      for (let c = nf.child; c; c = c.sibling) stack.push([c, pf ? c.alternate : null]);
    }
  };
  const hook = {
    renderers: new Map(), supportsFiber: true, isDisabled: false,
    inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
    checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      const now = performance.now();
      S.lastAny = now;
      if (!S.recording) return;
      S.commits++;
      if (!S.first) S.first = now;
      S.last = now;
      try { walk(root); } catch (e) { S.walkError = String(e); }
    },
  };
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true, writable: true });
  const observe = () => {
    new MutationObserver((list) => { if (S.recording) S.dom += list.length; }).observe(document.documentElement, {
      subtree: true, childList: true, attributes: true, characterData: true,
    });
  };
  if (document.documentElement) observe(); else document.addEventListener('DOMContentLoaded', observe);
})();`;
// Кто перерисовывается при открытии/закрытии окна записи (дев, имена компонентов)
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(HOOK);
  const page = await ctx.newPage();
  await page.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru', { waitUntil: 'networkidle' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  for (const step of ['open', 'close', 'nextday']) {
    await page.evaluate(() => window.__rr.start());
    if (step === 'open') await page.locator('[data-testid="booking-block"]').first().click();
    if (step === 'close') await page.keyboard.press('Escape');
    if (step === 'nextday') await page.getByRole('button', { name: 'Следующий день' }).click();
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => window.__rr.stop());
    const top = Object.entries(r.names).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(step, 'renders', r.renders, 'mounts', r.mounts, 'commits', r.commits, '\n  ', top);
  }
} finally { await browser.close(); release(); }
