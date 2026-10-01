// Замер мигания и плавности (DESIGN.md → «Nothing blinks, only what changed updates», владелец 27.09.2026).
// Дев-сервер: bash scripts/ensure-dev.sh
//
//   node scripts/flicker.mjs --label baseline               все сценарии, отчёт qa/flicker/baseline.json
//   node scripts/flicker.mjs --section journal              все сценарии одного раздела (journal, clients, shell, ui, control)
//   node scripts/flicker.mjs --only journal-day,ui-modal@phone
//   node scripts/flicker.mjs --list                         список сценариев
//
// Что меряется на каждом действии (от клика до «тишины»: ни коммитов React 700 мс, ни запросов в полёте,
// ни оверлея посреди анимации):
//   flashes  (a) мигание скелетона: [data-skeleton] / .skeleton-shimmer / .animate-pulse / aria-busy появился
//            там, где ДО действия было содержимое. refetch — после скелетона вернулся тот же текст (чистое
//            мигание); replace — скелетон между старыми и новыми данными (нарушает keepPrevious). Скелетон
//            в только что открытом окне/блоке (не было содержимого) — не мигание, считается отдельно (newBlocks).
//            aria-busy на блоке, который остаётся с данными (приглушён), — dims (предупреждение).
//   remounts (b) пересозданные блоки: узел удалён и тут же добавлен с тем же data-f / data-testid / текстом
//            (вместо правки на месте). В счёт идут блоки от 5 элементов; мелочь (имя, значок) — remountsSmall.
//            renders/mounts — сколько компонентов отрендерилось/смонтировалось (обход волокон, как renders.mjs).
//   cls      (c) сдвиг раскладки (PerformanceObserver 'layout-shift'): cls — классический (без недавнего ввода),
//            clsLate — сдвиги позже 150 мс после последнего клика/клавиши (приехали данные и толкнули страницу),
//            clsAll — все сдвиги за действие (справочно).
//   noAnim   (d) Modal/Sheet/Popover/Dropdown/Select/Toast/Tooltip, открытые или закрытые за действие: прозрачность
//            и transform (своя и предков) снимаются каждый кадр; открытие и закрытие должны длиться ≥ 100 мс.
//            Появился/исчез за один кадр — провал.
//   pageSwap (e) содержимое <main> заменено целиком (узел main пересоздан, удалено ≥ 50% его элементов,
//            скелетон на ≥ 50% его площади или смонтировано заново ≥ 60% компонентов страницы).
// Вердикт: fail — есть мигание (replace — только если сценарий не помечен newData), крупное пересоздание,
// clsLate/cls > 0.01, оверлей без анимации, подмена страницы (кроме сценариев-переходов navigation).
// Контрольные сценарии (раздел control) внедряют мигание через page.evaluate и ОБЯЗАНЫ провалиться.
//
// Параметры:
//   --label <имя>   имя отчёта (по умолчанию run)       --runs 2   прогонов на сценарий (медиана)
//   --only a,b      только эти сценарии (id или id@phone) --section journal,clients
//   --device phone  только одно устройство                --base http://localhost:3710
//   --shots         три кадра (до / во время / после) в qa/flicker/shots/<label>/ (первый прогон)
//   --merge         дописать сценарии в существующий отчёт --label
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'qa/flicker');

const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const [key, inline] = a.slice(2).split(/=(.*)/s);
  if (inline !== undefined) opts[key] = inline;
  else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) opts[key] = argv[++i];
  else opts[key] = true;
}

if (opts.help || opts.h) {
  const head = [];
  for (const l of fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')) {
    if (!l.startsWith('//')) break;
    head.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(head.join('\n'));
  process.exit(0);
}

const BASE = String(opts.base ?? 'http://localhost:3710').replace(/\/$/, '');
const RUNS = Math.max(1, Number(opts.runs ?? 2));
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};
/** Масштаб кадра CDP: ширина снимка ≤ 800 px */
const SHOT_SCALE = { desktop: 0.55, phone: 0.5 };

// ─────────────────────────── Счётчик в странице (ставится до React) ───────────────────────────
// Коммиты React — тот же обход волокон, что в renders.mjs (флаг PerformedWork; пропущенное поддерево не обходится).
// Плюс MutationObserver (скелетоны, удалённые/добавленные узлы, оверлеи), PerformanceObserver (layout-shift)
// и цикл requestAnimationFrame, который каждый кадр снимает прозрачность и transform открытых оверлеев.

const HOOK = String.raw`(() => {
  const PERFORMED_WORK = 1;
  const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);
  const SKEL = '[data-skeleton], .skeleton-shimmer, .animate-shimmer, .animate-pulse, [aria-busy="true"]';
  const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-popover-panel], [role="tooltip"], [data-toast-viewport] > *';
  const now = () => performance.now();
  const clip = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const describe = (el) => {
    if (!el || el.nodeType !== 1) return String(el && el.nodeName || '?');
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const f = el.getAttribute('data-f'); if (f) s += '[data-f=' + f.split(' ')[0] + ']';
    const tid = el.getAttribute('data-testid'); if (tid) s += '[' + tid + ']';
    const role = el.getAttribute('role'); if (role) s += '[role=' + role + ']';
    const al = el.getAttribute('aria-label'); if (al) s += '[' + clip(al, 30) + ']';
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    if (cls) s += '.' + cls;
    const t = clip(el.textContent, 50); if (t) s += ' «' + t + '»';
    return s;
  };
  const S = {
    recording: false, t0: 0, lastAny: 0, commits: 0, renders: 0, mounts: 0, first: 0, last: 0, root: null,
    pre: null, preText: null, preSkel: null, main: null, mainCount: 0, mainArea: 0, fibersAtStart: 0,
    skels: [], seenSkel: null, removed: [], added: [], overlays: [], shifts: [], inputs: [], vt: false, events: 0,
    countFibers() {
      if (!this.root) return 0;
      let n = 0; const stack = [this.root.current];
      while (stack.length) { const f = stack.pop(); if (COMPONENT_TAGS.has(f.tag)) n++; for (let c = f.child; c; c = c.sibling) stack.push(c); }
      return n;
    },
    start() {
      const t = now();
      Object.assign(this, { recording: true, t0: t, commits: 0, renders: 0, mounts: 0, first: 0, last: 0,
        skels: [], removed: [], added: [], shifts: [], inputs: [], vt: false, events: 0, seenSkel: new WeakSet() });
      this.overlays = [];
      this.pre = new WeakSet(); this.preText = new WeakMap(); this.preSkel = new WeakSet();
      for (const el of document.querySelectorAll('*')) { this.pre.add(el); this.preText.set(el, el.textContent || ''); }
      for (const sk of document.querySelectorAll(SKEL)) for (let a = sk; a; a = a.parentElement) this.preSkel.add(a);
      for (const sk of document.querySelectorAll(SKEL)) this.seenSkel.add(sk);
      this.main = document.querySelector('main#content') || document.querySelector('main');
      this.mainCount = this.main ? this.main.querySelectorAll('*').length : 0;
      const mr = this.main ? this.main.getBoundingClientRect() : null;
      this.mainArea = mr ? Math.max(1, Math.min(mr.width, innerWidth) * Math.min(mr.height, innerHeight)) : 1;
      this.fibersAtStart = this.countFibers();
      // Оверлеи, открытые ещё до действия: меряем только их закрытие
      for (const el of document.querySelectorAll(OVERLAY)) this.track(el, null);
      requestAnimationFrame(frame);
    },
    track(el, addedAt) {
      if (this.overlays.some((o) => o.el === el || (!o.done && o.el.contains(el)))) return;
      if (!el.getClientRects().length && addedAt === null) return;
      this.overlays.push({ el, addedAt, goneAt: null, done: false, samples: [], kind: describe(el).slice(0, 90) });
      this.events++;
    },
    handleSkel(el) {
      if (this.seenSkel.has(el)) return;
      this.seenSkel.add(el);
      if (el.closest('button,[role="button"],[role="switch"]')) return; // кнопка крутит лоадер в своей коробке — так и надо
      if (el.parentElement && el.parentElement.closest(SKEL)) return; // строка внутри одного скелетона — считаем скелетон целиком
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 150) return; // точка «идёт живое» и прочая мелочь
      let a = el;
      while (a && !this.pre.has(a)) a = a.parentElement;
      const before = a ? clip(this.preText.get(a), 600) : '';
      let kind;
      // aria-busy на блоке, который остаётся с данными (приглушён) — не скелетон, а «приглушение»
      const realSkel = el.matches('[data-skeleton], .skeleton-shimmer, .animate-shimmer, .animate-pulse') || el.querySelector('[data-skeleton], .skeleton-shimmer, .animate-shimmer, .animate-pulse');
      if (!realSkel && clip(el.textContent, 5)) kind = 'dim';
      else if (!a || a === document.body || a === document.documentElement) kind = 'new-block';
      else if (this.preSkel.has(a) && !before) kind = 'already-loading';
      else if (!before) kind = 'new-block';
      else kind = 'flash';
      const ar = a && a.getBoundingClientRect ? a.getBoundingClientRect() : r;
      const vis = (x) => Math.max(0, Math.min(x.right, innerWidth) - Math.max(x.left, 0)) * Math.max(0, Math.min(x.bottom, innerHeight) - Math.max(x.top, 0));
      this.skels.push({ el, a, kind, t: Math.round(now() - this.t0), goneAt: null, before,
        skel: describe(el).slice(0, 120), region: describe(a).slice(0, 160),
        mainShare: Math.round((vis(r) / this.mainArea) * 100) / 100, regionArea: Math.round(vis(ar)) });
      if (kind === 'flash') this.events++;
    },
    stop() {
      this.recording = false;
      const t0 = this.t0;
      const rel = (t) => (t == null ? null : Math.round(t - t0));
      // (a) скелетоны
      const words = (s) => new Set((s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1));
      const sim = (x, y) => { const A = words(x), B = words(y); if (!A.size && !B.size) return 1; let i = 0; for (const w of A) if (B.has(w)) i++; return i / Math.max(A.size, B.size); };
      const skels = this.skels.map((s) => {
        const after = clip(s.afterText != null ? s.afterText : s.a && s.a.isConnected ? s.a.textContent : '', 600);
        const out = { kind: s.kind, t: s.t, shownMs: s.goneAt == null ? null : Math.round(s.goneAt - t0) - s.t, skel: s.skel, region: s.region, mainShare: s.mainShare };
        if (s.kind === 'flash') { out.similarity = Math.round(sim(s.before, after) * 100) / 100; out.sub = out.similarity >= 0.85 ? 'refetch' : 'replace'; out.before = s.before.slice(0, 160); out.after = after.slice(0, 160); }
        return out;
      });
      // (b) пересозданные блоки
      const addedNodes = new Set(this.added.map((x) => x.node));
      const removedNodes = new Set(this.removed.map((x) => x.node));
      const isOverlay = (n) => n.matches(OVERLAY) || n.matches('[data-toast-viewport]') || Boolean(n.querySelector(OVERLAY));
      const isSkel = (n) => n.matches(SKEL) || (n.querySelector(SKEL) && clip(n.textContent, 5) === '');
      const sigOf = (n) => {
        const f = n.getAttribute('data-f'); if (f) return 'f:' + f + ':' + clip(n.getAttribute('aria-label') || n.textContent, 24); // один data-f у разных колонок/строк — различаем по началу текста
        const tid = n.getAttribute('data-testid'); if (tid) return 't:' + tid + ':' + clip(n.getAttribute('aria-label') || n.textContent, 24);
        const t = clip(n.textContent, 160); if (t.length >= 6) return 'x:' + n.tagName + ':' + t;
        return null;
      };
      const roots = (list, set) => list.filter((n) => { for (const o of set) if (o !== n && o.contains(n)) return false; return true; });
      const remList = roots([...removedNodes].filter((n) => !addedNodes.has(n)), removedNodes);
      const addList = roots([...addedNodes].filter((n) => !removedNodes.has(n) && n.isConnected), addedNodes);
      const bySig = new Map();
      const indexRemoved = (n, host) => { if (isOverlay(n) || isSkel(n)) return; const s = sigOf(n); if (s && !bySig.has(s)) bySig.set(s, { n, host }); };
      for (const r of remList) { indexRemoved(r, r); for (const x of r.querySelectorAll('[data-f],[data-testid]')) indexRemoved(x, r); }
      const remounts = []; const used = new Set();
      const tryMatch = (n) => { if (isOverlay(n) || isSkel(n)) return false; const s = sigOf(n); if (!s || used.has(s) || !bySig.has(s)) return false; used.add(s); remounts.push({ sig: s.slice(0, 90), size: n.querySelectorAll('*').length + 1, where: describe(n).slice(0, 140) }); return true; };
      for (const a of addList) { if (tryMatch(a)) continue; for (const x of a.querySelectorAll('[data-f],[data-testid]')) tryMatch(x); }
      // Вложенные совпадения внутри уже засчитанного крупного блока — не отдельные блоки
      remounts.sort((x, y) => y.size - x.size);
      // (e) подмена страницы
      const swap = [];
      if (this.main && !this.main.isConnected) swap.push('узел <main> пересоздан');
      const bigRemoved = this.removed.filter((x) => this.main && x.fromMain && !addedNodes.has(x.node)).reduce((m, x) => Math.max(m, x.size), 0);
      if (this.mainCount > 30 && bigRemoved >= this.mainCount * 0.5) swap.push('удалено ' + bigRemoved + ' из ' + this.mainCount + ' элементов main');
      const bigSkel = skels.filter((s) => s.kind === 'flash' && s.mainShare >= 0.5);
      if (bigSkel.length) swap.push('скелетон на ' + Math.round(bigSkel[0].mainShare * 100) + '% площади main');
      if (this.fibersAtStart > 50 && this.mounts >= this.fibersAtStart * 0.6) swap.push('смонтировано заново ' + this.mounts + ' из ' + this.fibersAtStart + ' компонентов');
      // (c) сдвиги
      const inputs = this.inputs;
      const lastInputBefore = (t) => { let v = -Infinity; for (const x of inputs) if (x <= t) v = x; return v; };
      let cls = 0, clsLate = 0, clsAll = 0; const lateShifts = [];
      for (const s of this.shifts) {
        clsAll += s.v; if (!s.input) cls += s.v;
        if (s.t - lastInputBefore(s.t) > 150) { clsLate += s.v; lateShifts.push({ t: Math.round(s.t - t0), v: Math.round(s.v * 10000) / 10000, src: s.src }); }
      }
      // (d) оверлеи
      const same = (a, b) => Math.abs(a[1] - b[1]) < 0.01 && a[2] === b[2];
      const overlays = this.overlays.map((o) => {
        const s = o.samples; const out = { kind: o.kind, opened: o.addedAt != null, closed: o.goneAt != null, openMs: null, closeMs: null, frames: s.length };
        if (!s.length) { if (out.opened) out.openMs = 0; if (out.closed) out.closeMs = 0; return out; }
        // Конец открытия — первый момент, после которого 3 кадра подряд без изменений
        let j = 0;
        for (let i = 0; i + 3 < s.length; i++) { if (same(s[i], s[i + 1]) && same(s[i + 1], s[i + 2]) && same(s[i + 2], s[i + 3])) { j = i; break; } j = i + 1; }
        // Отсчёт — от первого видимого кадра (до него панель могла стоять невидимой, пока считалась позиция)
        if (out.opened) out.openMs = j === 0 ? 0 : Math.round(s[j][0] - s[0][0] + 16);
        out.startOpacity = s[0][1];
        if (out.closed) {
          const stable = s[Math.min(j, s.length - 1)];
          let k = -1;
          for (let i = j + 1; i < s.length; i++) if (!same(s[i], stable)) { k = i; break; }
          out.closeMs = k < 0 ? 0 : Math.round(o.goneAt - t0 - s[k][0]);
          out.endOpacity = s[s.length - 1][1];
        }
        return out;
      }).filter((o) => o.opened || o.closed);
      return {
        commits: this.commits, renders: this.renders, mounts: this.mounts, fibersAtStart: this.fibersAtStart,
        settled: this.last ? rel(this.last) : null,
        skels, remounts, pageSwap: swap, overlays, vt: this.vt,
        cls: Math.round(cls * 10000) / 10000, clsLate: Math.round(clsLate * 10000) / 10000, clsAll: Math.round(clsAll * 10000) / 10000, lateShifts: lateShifts.slice(0, 5),
        addedEls: [...addedNodes].reduce((m, n) => m + (n.isConnected ? n.querySelectorAll('*').length + 1 : 0), 0),
      };
    },
  };
  window.__flk = S;
  function frame(t) {
    if (!S.recording) return;
    if (!S.vt && document.getAnimations) {
      try { S.vt = document.getAnimations().some((a) => String(a.effect && a.effect.pseudoElement || '').startsWith('::view-transition')); } catch {}
    }
    // Скелетон ушёл — запоминаем, что встало на его место (сравнение «до/после» — в этот момент, а не в конце действия)
    for (const s of S.skels) if (s.goneAt == null && (!s.el.isConnected || !s.el.matches(SKEL))) { s.goneAt = t; s.afterText = s.a && s.a.isConnected ? s.a.textContent : ''; }
    for (const o of S.overlays) {
      if (o.done) continue;
      const el = o.el;
      const cs0 = el.isConnected ? getComputedStyle(el) : null;
      const shown = cs0 && el.getClientRects().length && cs0.visibility !== 'hidden';
      // Ещё не показан (Popover ставит visibility:hidden, пока не посчитал позицию) — ждём, это не закрытие
      if (!shown && el.isConnected && !o.samples.length) continue;
      if (!shown) { o.goneAt = o.goneAt ?? t; o.done = true; continue; }
      let op = 1; const tf = [];
      for (let x = el; x && x !== document.body; x = x.parentElement) {
        const cs = getComputedStyle(x);
        op *= Number(cs.opacity);
        for (const p of ['transform', 'translate', 'scale', 'rotate']) if (cs[p] && cs[p] !== 'none') tf.push(p[0] + cs[p]);
      }
      o.samples.push([Math.round(t - S.t0), Math.round(op * 1000) / 1000, tf.join('|')]);
    }
    requestAnimationFrame(frame);
  }
  const nameOf = () => {};
  const walk = (root) => {
    const next = root.current;
    const stack = [[next, next.alternate]];
    while (stack.length) {
      const [nf, pf] = stack.pop();
      if (COMPONENT_TAGS.has(nf.tag)) {
        const mounted = !pf;
        if (mounted || (nf.flags & PERFORMED_WORK) === PERFORMED_WORK) { S.renders++; if (mounted) S.mounts++; }
      }
      if (pf && nf.child === pf.child) continue;
      for (let c = nf.child; c; c = c.sibling) stack.push([c, pf ? c.alternate : null]);
    }
  };
  const hook = {
    renderers: new Map(), supportsFiber: true, isDisabled: false,
    inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
    checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      const t = now();
      S.lastAny = t; S.root = root;
      if (!S.recording) return;
      S.commits++; if (!S.first) S.first = t; S.last = t;
      try { walk(root); } catch (e) { S.walkError = String(e); }
    },
  };
  void nameOf;
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true, writable: true });
  const observe = () => {
    new MutationObserver((list) => {
      if (!S.recording) return;
      const t = now();
      for (const rec of list) {
        if (rec.type === 'childList') {
          const fromMain = S.main && (rec.target === S.main || S.main.contains(rec.target));
          for (const n of rec.removedNodes) if (n.nodeType === 1) S.removed.push({ node: n, t, fromMain, size: n.querySelectorAll('*').length + 1 });
          for (const n of rec.addedNodes) {
            if (n.nodeType !== 1) continue;
            S.added.push({ node: n, t });
            if (n.matches(SKEL)) S.handleSkel(n);
            for (const x of n.querySelectorAll(SKEL)) S.handleSkel(x);
            if (n.matches(OVERLAY)) S.track(n, t);
            for (const x of n.querySelectorAll(OVERLAY)) S.track(x, t);
          }
          for (const o of S.overlays) if (!o.done && !o.el.isConnected) { o.goneAt = t; o.done = true; }
        } else if (rec.type === 'attributes' && rec.target.nodeType === 1) {
          if (rec.target.matches(SKEL)) S.handleSkel(rec.target);
          if (rec.attributeName === 'role' && rec.target.matches(OVERLAY)) S.track(rec.target, t);
        }
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-busy', 'data-skeleton', 'role'] });
    try {
      new PerformanceObserver((list) => {
        if (!S.recording) return;
        for (const e of list.getEntries()) S.shifts.push({ t: e.startTime, v: e.value, input: e.hadRecentInput, src: (e.sources || []).slice(0, 3).map((x) => describe(x.node).slice(0, 80)) });
      }).observe({ type: 'layout-shift', buffered: false });
    } catch {}
    for (const ev of ['pointerdown', 'keydown', 'mousedown', 'touchstart']) addEventListener(ev, () => { if (S.recording) S.inputs.push(now()); }, true);
  };
  if (document.documentElement) observe(); else document.addEventListener('DOMContentLoaded', observe);
})();`;

// ─────────────────────────── Сценарии ───────────────────────────
// Карта «раздел → сценарии». Новый раздел — несколько строк: id, title, route, prepare (довести экран до
// исходного состояния, не меряется), act (само действие — меряется). Необязательно: devices (по умолчанию
// оба), persona (owner), result (условие «результат виден» — строка JS для страницы), newData (действие
// законно показывает НОВЫЕ данные — скелетон вместо старых = предупреждение, не провал), navigation
// (переход на другую страницу — подмена main ожидаема). «services» пока не добавлен: раздел переписывается.

const textOf = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].map((e) => e.textContent).join('|')`;
const ruDay = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
};
const noSkeleton = `!document.querySelector('main [data-skeleton]')`;
const waitNoSkeleton = (page) => page.waitForFunction(noSkeleton, null, { timeout: 60000 }).catch(() => {});
const vis = (page, sel) => page.locator(`${sel}:visible`).first();
/** Дождаться, пока все оверлеи закроются (ушли из DOM) */
const waitClosed = (page, sel = '[role="dialog"]', timeout = 8000) =>
  page.waitForFunction((s) => ![...document.querySelectorAll(s)].some((e) => e.getClientRects().length), sel, { timeout }).catch(() => {});
const pause = (page, ms) => page.waitForTimeout(ms);

const journalReady = async (page) => {
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 60000 });
  await waitNoSkeleton(page);
};
const clientsReady = async (page) => {
  await vis(page, 'input[placeholder^="Имя, телефон"]').waitFor({ timeout: 60000 });
  await page.locator('main a[href^="/biz/journal?new=1&client="], main [data-testid="client-row"], main tbody tr').first().waitFor({ timeout: 60000 }).catch(() => {});
  await waitNoSkeleton(page);
};
const CARD = '/biz/clients/cl_081';
const cardReady = async (page) => {
  await page.getByRole('tab', { name: 'О клиенте' }).first().waitFor({ timeout: 60000 });
  await waitNoSkeleton(page);
};
const uiReady = async (page) => {
  await page.getByRole('button', { name: 'Modal md' }).waitFor({ timeout: 60000 });
};

const SECTIONS = {
  journal: [
    {
      id: 'journal-day',
      title: 'Журнал: соседний день',
      route: '/biz/journal',
      prepare: async (page) => {
        await journalReady(page);
        return { before: await page.evaluate(textOf('[data-testid="booking-block"]')) };
      },
      act: async (page, _s, device) => {
        // Полоса дней на телефоне — текущая неделя: соседний день, который в ней виден
        if (device === 'phone') await vis(page, `button[aria-label="${ruDay(1)}"], button[aria-label="${ruDay(-1)}"]`).click();
        else await vis(page, 'button[aria-label="Следующий день"]').click();
      },
      result: (s) => `${textOf('[data-testid="booking-block"]')} !== ${JSON.stringify(s.before)}`,
    },
    {
      id: 'journal-view',
      title: 'Журнал: День → Неделя → День',
      route: '/biz/journal',
      devices: ['desktop'],
      newData: true,
      prepare: journalReady,
      act: async (page) => {
        await page.getByRole('radio', { name: 'Неделя' }).click();
        await pause(page, 1500);
        await page.getByRole('radio', { name: 'День' }).click();
      },
    },
    {
      id: 'journal-open',
      title: 'Журнал: открыть и закрыть окно записи',
      route: '/biz/journal',
      prepare: journalReady,
      act: async (page) => {
        await page.locator('[data-testid="booking-block"]:visible').first().click();
        const dlg = page.locator('[role="dialog"]').first();
        await dlg.waitFor({ timeout: 10000 });
        await pause(page, 1500);
        await dlg.locator('button[aria-label="Закрыть"]').first().click();
        await waitClosed(page);
      },
    },
    {
      id: 'journal-status',
      title: 'Журнал: смена статуса во всплывающей карточке',
      route: '/biz/journal',
      prepare: async (page) => {
        await journalReady(page);
        await vis(page, 'button[title="Статус и оплата"], button[aria-label="Статус и оплата"]').click();
        await page.locator('[role="dialog"] button').first().waitFor();
        const target = await page.evaluate(() => {
          const names = ['Пришёл', 'Не пришёл', 'Клиент подтвердил', 'Записан'];
          const btns = [...document.querySelectorAll('[role="dialog"] button')];
          for (const n of names) {
            const b = btns.find((x) => x.textContent.trim() === n);
            if (b && !b.className.split(/\s+/).includes('bg-primary') && b.getAttribute('aria-pressed') !== 'true') return n;
          }
          return null;
        });
        if (!target) throw new Error('нет кнопки статуса');
        await pause(page, 600);
        return { target };
      },
      act: async (page, s) => {
        await page.locator('[role="dialog"] button', { hasText: s.target }).first().click();
        await waitClosed(page, '[data-popover-panel], [role="dialog"]', 4000);
      },
    },
    {
      id: 'journal-create',
      title: 'Журнал: создать запись (выбор типа → окно → услуга → сохранить)',
      route: '/biz/journal',
      devices: ['desktop'],
      prepare: journalReady,
      act: async (page) => {
        await page.getByRole('button', { name: 'Новая запись' }).first().click();
        await page.getByRole('button', { name: /^Запись/ }).first().click();
        const dlg = page.locator('[role="dialog"]').last();
        await dlg.getByRole('button', { name: /^Маникюр классический/ }).first().click({ timeout: 15000 });
        await pause(page, 400);
        await dlg.getByRole('button', { name: /^Записать/ }).last().click();
        // «Создать без клиента?» — подтверждаем
        const ok = page.locator('[role="dialog"] button, [role="alertdialog"] button', { hasText: /^(Всё равно сохранить|Создать|Да)/ }).last();
        if (await ok.isVisible({ timeout: 3000 }).catch(() => false)) await ok.click();
        await waitClosed(page, '[role="dialog"]', 10000);
      },
    },
    {
      id: 'journal-drag',
      title: 'Журнал: перетащить запись на час ниже',
      route: '/biz/journal',
      devices: ['desktop'],
      prepare: async (page) => {
        await journalReady(page);
        // Блок целиком в окне и с местом под ним (иначе мышь уйдёт за край)
        const box = await page.evaluate(() => {
          const r = [...document.querySelectorAll('[data-testid="booking-block"]')]
            .map((e) => e.getBoundingClientRect())
            .find((b) => b.width > 0 && b.top > 150 && b.bottom < innerHeight - 160);
          return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
        });
        if (!box) throw new Error('нет блока записи в окне');
        return { box };
      },
      act: async (page, s) => {
        const x = s.box.x + s.box.width / 2;
        const y = s.box.y + 20;
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(x, y + i * 8);
          await pause(page, 16);
        }
        await page.mouse.up();
        // Если журнал спрашивает подтверждение переноса — соглашаемся
        const confirm = page.locator('[role="dialog"] button, [role="alertdialog"] button', { hasText: /Перенести|Сохранить|Да|Подтвердить/ });
        if (await confirm.first().isVisible({ timeout: 1500 }).catch(() => false)) await confirm.first().click();
      },
    },
    {
      id: 'journal-attention',
      title: 'Журнал: свернуть и развернуть «Требует внимания»',
      route: '/biz/journal',
      devices: ['desktop'],
      prepare: journalReady,
      act: async (page) => {
        await vis(page, 'button[aria-label="Свернуть панель"]').click();
        await pause(page, 900);
        await vis(page, 'button[aria-label^="Развернуть панель"]').click({ timeout: 5000 });
      },
    },
  ],
  clients: [
    {
      id: 'clients-search',
      title: 'Клиенты: поиск «Ани»',
      route: '/biz/clients',
      prepare: clientsReady,
      act: async (page) => {
        await vis(page, 'input[placeholder^="Имя, телефон"]').pressSequentially('Ани', { delay: 80 });
        await pause(page, 1200);
      },
    },
    {
      id: 'clients-filter',
      // Один шаг: «туда и обратно» пересоздаёт строки законно (их не было на экране между шагами)
      title: 'Клиенты: быстрый фильтр «Новые»',
      route: '/biz/clients',
      newData: true,
      prepare: clientsReady,
      act: async (page) => {
        await page.locator('main button:visible', { hasText: /^Новые/ }).first().click();
        await pause(page, 1200);
      },
    },
    {
      id: 'clients-open',
      title: 'Клиенты: открыть карточку из списка',
      route: '/biz/clients',
      navigation: true,
      newData: true,
      prepare: clientsReady,
      act: async (page) => {
        // Десктоп — ячейка имени в строке таблицы, телефон — кнопка-карточка в списке
        const link = page.locator('main tbody tr:visible td:nth-child(2), main ul > li:visible > button:visible').first();
        await link.click();
        await page.waitForURL(/\/biz\/clients\/cl_/, { timeout: 15000 });
      },
      result: () => `/\\/biz\\/clients\\/cl_/.test(location.pathname) && ${noSkeleton}`,
    },
    {
      id: 'clients-card-tabs',
      title: 'Карточка клиента: вкладки История → О клиенте → Статистика → История',
      route: CARD,
      newData: true,
      prepare: cardReady,
      act: async (page) => {
        for (const name of ['О клиенте', 'Статистика', 'История визитов']) {
          await page.getByRole('tab', { name }).first().click();
          await pause(page, 1200);
        }
      },
    },
    {
      id: 'clients-card-edit',
      title: 'Карточка клиента: «Изменить» → поправить email → сохранить',
      route: `${CARD}?tab=about`,
      prepare: cardReady,
      act: async (page) => {
        await vis(page, 'main button[aria-label="Ещё"]').click();
        await page.getByRole('menuitem', { name: 'Изменить' }).click();
        const dlg = page.locator('[role="dialog"]').last();
        await dlg.waitFor();
        await pause(page, 500);
        const email = dlg.locator('input[type="email"], input[name="email"], input[inputmode="email"]').first();
        await email.fill(`flk${Date.now() % 100000}@mail.am`);
        await dlg.getByRole('button', { name: 'Сохранить' }).click();
        await waitClosed(page, '[role="dialog"]', 8000);
      },
    },
    {
      id: 'clients-dialogs',
      title: 'Клиенты: «Добавить клиента» и «Фильтры» — открыть и закрыть',
      route: '/biz/clients',
      prepare: clientsReady,
      act: async (page) => {
        // Десктоп — кнопка в шапке, телефон — плавающая кнопка с тем же названием (aria-label)
        await page.locator('button:visible', { hasText: /^Добавить клиента$/ }).or(page.locator('button[aria-label="Добавить клиента"]:visible')).first().click();
        await page.locator('[role="dialog"]').first().waitFor();
        await pause(page, 800);
        await page.keyboard.press('Escape');
        await waitClosed(page);
        await page.locator('main button:visible', { hasText: /^Фильтры/ }).or(page.locator('main button[aria-label^="Фильтры"]:visible')).first().click();
        await page.locator('[role="dialog"]').first().waitFor();
        await pause(page, 800);
        await page.keyboard.press('Escape');
        await waitClosed(page);
      },
    },
  ],
  shell: [
    {
      id: 'shell-sidebar',
      title: 'Каркас: свернуть и развернуть левое меню',
      route: '/biz/clients',
      devices: ['desktop'],
      prepare: clientsReady,
      act: async (page) => {
        await vis(page, 'button[aria-label="Свернуть меню"]').click();
        await pause(page, 900);
        await vis(page, 'button[aria-label="Развернуть меню"]').click();
      },
    },
    {
      id: 'shell-location',
      title: 'Каркас: переключить филиал (сеть)',
      route: '/biz/clients',
      persona: 'network',
      devices: ['desktop'],
      newData: true,
      prepare: clientsReady,
      act: async (page) => {
        await vis(page, 'button[role="combobox"][aria-label="Локация"], [data-f="F-15-014"] button[role="combobox"], button[role="combobox"][data-f="F-15-014"]').click();
        const opts = page.getByRole('option');
        await opts.first().waitFor();
        const n = await opts.count();
        await opts.nth(Math.min(1, n - 1)).click();
      },
    },
    {
      id: 'shell-notifications',
      title: 'Каркас: уведомления — открыть и закрыть',
      route: '/biz/clients',
      prepare: clientsReady,
      act: async (page) => {
        await vis(page, 'header button[aria-label="Уведомления"], button[aria-label="Уведомления"]').click();
        await page.locator('[data-popover-panel], [role="dialog"]').first().waitFor();
        await pause(page, 900);
        await page.keyboard.press('Escape');
        await waitClosed(page, '[data-popover-panel], [role="dialog"]');
      },
    },
    {
      id: 'shell-usermenu',
      title: 'Каркас: меню пользователя — открыть и закрыть',
      route: '/biz/clients',
      prepare: clientsReady,
      act: async (page) => {
        await vis(page, 'button[aria-label="Меню пользователя"]').click();
        await page.locator('[role="menu"], [role="dialog"]').first().waitFor();
        await pause(page, 900);
        await page.keyboard.press('Escape');
        await waitClosed(page, '[data-popover-panel], [role="menu"], [role="dialog"]');
      },
    },
    {
      id: 'shell-drawer',
      title: 'Каркас: меню на телефоне — открыть и закрыть',
      route: '/biz/clients',
      devices: ['phone'],
      prepare: clientsReady,
      act: async (page) => {
        await vis(page, 'button[aria-label="Открыть меню"]').click();
        await page.locator('[role="dialog"]').first().waitFor();
        await pause(page, 900);
        await page.keyboard.press('Escape');
        await waitClosed(page);
      },
    },
  ],
  ui: [
    {
      id: 'ui-modal',
      title: 'UI-кит: Modal — открыть и закрыть',
      route: '/dev/ui/b',
      prepare: uiReady,
      act: async (page) => {
        await page.getByRole('button', { name: 'Modal md' }).click();
        await page.locator('[role="dialog"]').first().waitFor();
        await pause(page, 800);
        await page.keyboard.press('Escape');
        await waitClosed(page);
      },
    },
    {
      id: 'ui-sheet',
      title: 'UI-кит: Sheet — открыть и закрыть',
      route: '/dev/ui/b',
      prepare: uiReady,
      act: async (page) => {
        await page.getByRole('button', { name: 'Sheet auto' }).click();
        await page.locator('[role="dialog"]').first().waitFor();
        await pause(page, 900);
        await page.keyboard.press('Escape');
        await waitClosed(page);
      },
    },
    {
      id: 'ui-popover',
      title: 'UI-кит: Popover — открыть и «Понятно»',
      route: '/dev/ui/b',
      devices: ['desktop'],
      prepare: uiReady,
      act: async (page) => {
        await page.getByRole('button', { name: 'Popover', exact: true }).click();
        await page.getByRole('button', { name: 'Понятно' }).click({ timeout: 5000 });
        await waitClosed(page, '[data-popover-panel]');
      },
    },
    {
      id: 'ui-dropdown',
      title: 'UI-кит: DropdownMenu — открыть и закрыть',
      route: '/dev/ui/b',
      prepare: uiReady,
      act: async (page) => {
        await page.locator('main button[aria-label="Ещё"]:visible').first().click();
        await page.locator('[role="menu"]').first().waitFor();
        await pause(page, 700);
        await page.keyboard.press('Escape');
        await waitClosed(page, '[data-popover-panel], [role="menu"]');
      },
    },
    {
      id: 'ui-select',
      title: 'UI-кит: Select — открыть и выбрать другое значение',
      route: '/dev/ui/b',
      prepare: uiReady,
      act: async (page) => {
        // Первый видимый Select витрины (у разных ширин разный набор: «Район» в панели фильтров, размер страницы)
        const sel = page.locator('button[role="combobox"]:visible').first();
        await sel.scrollIntoViewIfNeeded();
        await sel.click();
        const opt = page.locator('[role="option"]:not([aria-selected="true"])').first();
        await opt.waitFor();
        await pause(page, 500);
        await opt.click();
        await waitClosed(page, '[data-popover-panel], [role="listbox"]');
      },
    },
    {
      id: 'ui-datepicker',
      title: 'UI-кит: DatePicker — открыть и выбрать день',
      route: '/dev/ui/b',
      prepare: uiReady,
      act: async (page) => {
        const label = page.locator('label', { hasText: 'DatePicker (с очисткой' });
        const trigger = label.locator('button').first();
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        const panel = page.locator('[data-popover-panel], [role="dialog"]').last();
        await panel.waitFor();
        await pause(page, 500);
        const day = panel.locator('button[aria-label]:not([disabled])', { hasText: /^\d{1,2}$/ });
        await day.nth(Math.min(3, (await day.count()) - 1)).click();
        await waitClosed(page, '[data-popover-panel], [role="dialog"]');
      },
    },
    {
      id: 'ui-toast',
      title: 'UI-кит: Toast — появиться и уйти самому',
      route: '/dev/ui/b',
      prepare: uiReady,
      act: async (page) => {
        const b = page.getByRole('button', { name: 'success', exact: true });
        await b.scrollIntoViewIfNeeded();
        await b.click();
        await page.locator('[data-toast-viewport] > *').first().waitFor();
        await page.mouse.move(2, 2);
        await page.waitForFunction(() => !document.querySelector('[data-toast-viewport] > *'), null, { timeout: 9000 }).catch(() => {});
      },
    },
    {
      id: 'ui-confirm',
      title: 'UI-кит: useConfirm() — открыть, «Не отменять», тост',
      route: '/dev/ui/b',
      devices: ['desktop'],
      prepare: uiReady,
      act: async (page) => {
        await page.getByRole('button', { name: 'useConfirm()' }).click();
        await page.getByRole('button', { name: 'Не отменять' }).click();
        await waitClosed(page, '[role="dialog"], [role="alertdialog"]');
      },
    },
  ],
  integrations: [
    {
      id: 'integrations-category',
      title: 'Интеграции: категория «Уведомления» (переход на страницу категории)',
      route: '/biz/integrations',
      newData: true,
      navigation: true,
      prepare: async (page) => {
        await vis(page, 'input[aria-label="Поиск приложений"]').waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        await page.locator('main button:visible', { hasText: /^Уведомления\d/ }).first().click();
        await pause(page, 1200);
      },
    },
    {
      id: 'integrations-search',
      title: 'Интеграции: поиск «tele»',
      route: '/biz/integrations',
      newData: true,
      prepare: async (page) => {
        await vis(page, 'input[aria-label="Поиск приложений"]').waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        await vis(page, 'input[aria-label="Поиск приложений"]').pressSequentially('tele', { delay: 80 });
        await pause(page, 1200);
      },
    },
  ],
  resources: [
    {
      id: 'resources-tabs',
      title: 'Ресурсы: вкладки «Архив» → «Действующие»',
      route: '/biz/resources',
      newData: true,
      prepare: async (page) => {
        await page.getByRole('tab', { name: /^Архив/ }).first().waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        await page.getByRole('tab', { name: /^Архив/ }).first().click();
        await pause(page, 1200);
        await page.getByRole('tab', { name: /^Действующие/ }).first().click();
        await pause(page, 1200);
      },
    },
    {
      id: 'resources-switch',
      title: 'Ресурсы: выключить и включить ресурс переключателем',
      route: '/biz/resources',
      prepare: async (page) => {
        await vis(page, 'main [role="switch"]').waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        const sw = vis(page, 'main [role="switch"]');
        await sw.click();
        await pause(page, 1200);
        // Выключение может спросить подтверждение — соглашаемся, затем включаем обратно
        const ok = page.locator('[role="dialog"] button, [role="alertdialog"] button', { hasText: /^(Выключить|Отключить|Да|Подтвердить)/ }).last();
        if (await ok.isVisible({ timeout: 1500 }).catch(() => false)) {
          await ok.click();
          await pause(page, 1000);
        }
        await vis(page, 'main [role="switch"]').click();
        await pause(page, 1200);
      },
    },
  ],
  // Положительный контроль детектора: мигание и оверлей без анимации внедряются в страницу через page.evaluate
  // (исходники не трогаются). Эти сценарии ОБЯЗАНЫ дать fail — иначе детектор слеп.
  // Приложение клиента (капп, 27.09.2026): фильтры поиска, вкладки записей, день в выборе времени, ❤, окно отмены
  client: [
    {
      id: 'capp-search-day',
      title: 'Клиент: поиск — «Свободно сегодня» и обратно',
      route: '/search',
      persona: 'client',
      prepare: async (page) => {
        await page.locator('main a[href^="/masters/"]').first().waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        const chip = vis(page, 'main button[aria-pressed]:has-text("Свободно сегодня")');
        await chip.click();
        await pause(page, 1500);
        await chip.click();
      },
    },
    {
      id: 'capp-search-panel',
      title: 'Клиент: поиск — панель «Фильтры» открыть и закрыть',
      route: '/search',
      persona: 'client',
      prepare: async (page) => {
        await page.locator('main a[href^="/masters/"]').first().waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        await vis(page, 'main button[aria-label^="Фильтры"]').click();
        await pause(page, 700);
        await page.keyboard.press('Escape');
        await waitClosed(page);
      },
    },
    {
      id: 'capp-bookings-tabs',
      title: 'Клиент: мои записи — Прошедшие → Предстоящие',
      route: '/bookings',
      persona: 'client',
      prepare: async (page) => {
        await page.locator('main a[href^="/bookings/"]').first().waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        await vis(page, 'main button:has-text("Прошедшие")').click();
        await pause(page, 800);
        await vis(page, 'main button:has-text("Предстоящие")').click();
      },
    },
    {
      id: 'capp-slot-day',
      title: 'Клиент: запись — другой день в выборе времени',
      route: '/masters/st_kaytsak_erik',
      persona: 'client',
      sphere: 'barber',
      prepare: async (page) => {
        await vis(page, 'main a[href*="/book?staff=st_kaytsak_erik&service="]').click();
        await page.waitForURL(/\/book\?/, { timeout: 60000 });
        await page.locator('main button[aria-pressed="false"]').first().waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        await vis(page, 'main button[aria-pressed="false"]').click();
      },
    },
    {
      id: 'capp-favorite',
      title: 'Клиент: ❤ на карточке мастера — поставить и снять',
      route: '/masters/st_kaytsak_erik',
      persona: 'client',
      sphere: 'barber',
      prepare: async (page) => {
        await page.locator('main [data-f~="F-00-113"]').first().waitFor({ timeout: 60000 });
        await waitNoSkeleton(page);
      },
      act: async (page) => {
        const heart = vis(page, 'main button[data-f~="F-00-113"]');
        await heart.click();
        await pause(page, 1200);
        await heart.click();
      },
    },
  ],
  control: [
    {
      id: 'control-flash',
      title: 'Контроль: внедрённое мигание скелетона в карточке записи',
      route: '/biz/journal',
      devices: ['desktop'],
      control: true,
      prepare: journalReady,
      act: async (page) => {
        await page.evaluate(async () => {
          const block = document.querySelector('[data-testid="booking-block"]');
          const box = block.parentElement;
          const saved = [...box.childNodes];
          const skel = document.createElement('span');
          skel.setAttribute('data-skeleton', '');
          skel.className = 'block skeleton-shimmer animate-shimmer';
          skel.style.cssText = `display:block;width:${block.offsetWidth}px;height:${block.offsetHeight}px`;
          box.replaceChildren(skel);
          await new Promise((r) => setTimeout(r, 350));
          box.replaceChildren(...saved.map((n) => n.cloneNode(true)));
        });
      },
    },
    {
      id: 'control-noanim',
      title: 'Контроль: внедрённое окно, которое появляется и исчезает за кадр',
      route: '/dev/ui/b',
      devices: ['desktop'],
      control: true,
      prepare: uiReady,
      act: async (page) => {
        await page.evaluate(async () => {
          const d = document.createElement('div');
          d.setAttribute('role', 'dialog');
          d.textContent = 'Окно без анимации';
          d.style.cssText = 'position:fixed;inset:30% 30%;background:#fff;z-index:100;padding:24px';
          document.body.append(d);
          await new Promise((r) => setTimeout(r, 500));
          d.remove();
        });
      },
    },
  ],
};

/** Плоский список: сценарий × устройство. id на телефоне — «…@phone». */
function allScenarios() {
  const out = [];
  for (const [section, list] of Object.entries(SECTIONS)) {
    for (const sc of list) {
      for (const device of sc.devices ?? ['desktop', 'phone']) {
        out.push({ ...sc, section, device, key: device === 'desktop' ? sc.id : `${sc.id}@phone` });
      }
    }
  }
  return out;
}

// ─────────────────────────── Прогон ───────────────────────────

function median(values) {
  const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.floor((v.length - 1) / 2)];
}

async function waitQuiet(page, quietMs = 700, maxMs = 15000) {
  await page
    .waitForFunction(
      (q) => {
        const f = window.__flk;
        if (!f) return true;
        const busyOverlay = f.recording && f.overlays.some((o) => !o.done && o.samples.length >= 2 && (() => {
          const s = o.samples; const a = s[s.length - 1]; const b = s[s.length - 2];
          return Math.abs(a[1] - b[1]) > 0.005 || a[2] !== b[2];
        })());
        return performance.now() - (f.lastAny ?? 0) > q && !((window.__bpApiStats?.inflight ?? 0) > 0) && !busyOverlay;
      },
      quietMs,
      { timeout: maxMs, polling: 100 },
    )
    .catch(() => {});
}

function buildUrl(sc) {
  const sep = sc.route.includes('?') ? '&' : '?';
  return `${BASE}${sc.route}${sep}demo=${sc.persona ?? 'owner'}&sphere=${sc.sphere ?? 'nails'}&lang=ru&theme=light&api=normal`;
}

async function shot(page, cdp, device, file) {
  const vp = page.viewportSize();
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: 55,
    clip: { x: 0, y: 0, width: vp.width, height: vp.height, scale: SHOT_SCALE[device] },
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return path.relative(ROOT, file);
}

async function runOnce(browser, sc, withShots, label) {
  const context = await browser.newContext({ ...DEVICES[sc.device], locale: 'ru-RU' });
  await context.addInitScript(HOOK);
  const page = await context.newPage();
  const problems = [];
  let tainted = false;
  page.on('console', (m) => {
    const text = m.text();
    if (/Fast Refresh|\[HMR\]/.test(text) && !/connected/.test(text)) tainted = tainted || text.slice(0, 60);
    if (m.type() === 'error' && !/WebSocket|_next\/hmr|Download the React DevTools/.test(text)) problems.push(text.slice(0, 200));
  });
  page.on('pageerror', (e) => problems.push(String(e).slice(0, 200)));
  try {
    await page.goto(buildUrl(sc), { waitUntil: 'networkidle', timeout: 180000 });
    await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
    const state = (await sc.prepare(page)) ?? {};
    await waitQuiet(page, 900, 20000);
    tainted = false;
    const cdp = withShots ? await context.newCDPSession(page) : null;
    const shots = [];
    const dir = path.join(OUT_DIR, 'shots', label);
    if (cdp) shots.push(await shot(page, cdp, sc.device, path.join(dir, `${sc.key.replace('@', '-')}-0.jpg`)));
    await page.evaluate(() => window.__flk.start());
    const t0 = Date.now();
    const actP = sc.act(page, state, sc.device);
    if (cdp) {
      // Кадр «во время»: первое мигание/оверлей, иначе через 250 мс
      await page.waitForFunction(() => window.__flk.events > 0, null, { timeout: 1500, polling: 'raf' }).catch(() => {});
      await page.waitForTimeout(40);
      shots.push(await shot(page, cdp, sc.device, path.join(dir, `${sc.key.replace('@', '-')}-1.jpg`)));
    }
    await actP;
    if (sc.result) {
      try {
        await page.waitForFunction(sc.result(state), null, { timeout: 15000, polling: 'raf' });
      } catch {
        problems.push('результат не дождался за 15 с');
      }
    }
    await waitQuiet(page);
    if (!(await page.evaluate(() => window.__flk?.recording))) tainted = tainted || 'страница перезагрузилась';
    const m = await page.evaluate(() => window.__flk.stop());
    if (cdp) shots.push(await shot(page, cdp, sc.device, path.join(dir, `${sc.key.replace('@', '-')}-2.jpg`)));
    m.wall = Date.now() - t0;
    return { ...m, shots, tainted, problems };
  } finally {
    await context.close();
  }
}

/** Сводка одного прогона: числа для таблицы и вердикта */
function summarize(r, sc) {
  const flashes = r.skels.filter((s) => s.kind === 'flash');
  const refetch = flashes.filter((s) => s.sub === 'refetch').length;
  const replace = flashes.filter((s) => s.sub === 'replace').length;
  const bigRemounts = r.remounts.filter((x) => x.size >= 5);
  const noAnim = r.overlays.filter((o) => (o.opened && o.openMs < 100) || (o.closed && o.closeMs < 100));
  return {
    flashes: refetch + (sc.newData ? 0 : replace),
    flashesNewData: sc.newData ? replace : 0,
    refetch,
    replace,
    newBlocks: r.skels.filter((s) => s.kind === 'new-block').length,
    dims: r.skels.filter((s) => s.kind === 'dim').length,
    remounts: bigRemounts.length,
    remountedEls: bigRemounts.reduce((m, x) => m + x.size, 0),
    remountsSmall: r.remounts.length - bigRemounts.length,
    renders: r.renders,
    mounts: r.mounts,
    cls: r.cls,
    clsLate: r.clsLate,
    clsAll: r.clsAll,
    overlays: r.overlays.length,
    noAnim: noAnim.length,
    pageSwap: r.pageSwap.length ? 1 : 0,
  };
}

function verdict(s, sc) {
  const fails = [];
  const warns = [];
  if (s.flashes) fails.push(`мигание скелетона ×${s.flashes}`);
  if (s.flashesNewData) warns.push(`скелетон вместо прежних данных ×${s.flashesNewData}`);
  // Переход на другую страницу пересоздаёт её блоки законно — только предупреждение
  if (s.remounts) (sc.navigation ? warns : fails).push(`пересоздано блоков ${s.remounts} (${s.remountedEls} эл.)`);
  if (s.dims) warns.push(`блок приглушён на время загрузки ×${s.dims}`);
  if (s.remountsSmall) warns.push(`мелких пересозданий ${s.remountsSmall}`);
  if (s.clsLate > 0.01 || s.cls > 0.01) fails.push(`сдвиг раскладки ${Math.max(s.clsLate, s.cls)}`);
  else if (s.clsAll > 0.05) warns.push(`сдвиг сразу после клика ${s.clsAll}`);
  if (s.noAnim) fails.push(`без анимации ×${s.noAnim}`);
  if (s.pageSwap && !sc.navigation) fails.push('подмена всей страницы');
  return { verdict: fails.length ? 'fail' : warns.length ? 'warn' : 'ok', fails, warns };
}

async function measure() {
  const { chromium } = await import('@playwright/test');
  // Сервер отвечает хоть чем-то (health может отдавать 500, пока соседний раздел чинит сборку)
  const health = await fetch(`${BASE}/dev/health`).then((r) => r.status > 0).catch(() => false);
  if (!health) {
    console.error(`Сервер ${BASE} не отвечает — bash scripts/ensure-dev.sh`);
    process.exit(1);
  }
  const only = opts.only ? String(opts.only).split(',') : undefined;
  const sections = opts.section ? String(opts.section).split(',') : undefined;
  const list = allScenarios().filter(
    (s) =>
      (!only || only.includes(s.key) || only.includes(s.id)) &&
      (!sections || sections.includes(s.section)) &&
      (!opts.device || s.device === opts.device) &&
      (only || sections || s.section !== 'control' || !opts['no-control']),
  );
  if (!list.length) {
    console.error('Нет сценариев под фильтр — node scripts/flicker.mjs --list');
    process.exit(1);
  }
  const label = String(opts.label ?? 'run');
  const file = path.join(OUT_DIR, `${label}.json`);
  const report =
    opts.merge && fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : { label, at: new Date().toISOString(), base: BASE, runs: RUNS, scenarios: [] };
  const put = (row) => {
    const i = report.scenarios.findIndex((x) => x.key === row.key);
    if (i >= 0) report.scenarios[i] = row;
    else report.scenarios.push(row);
  };
  let browser = await chromium.launch();
  try {
    for (const sc of list) {
      const runs = [];
      let attempts = 0;
      while (runs.length < RUNS && attempts < RUNS + 4) {
        attempts++;
        try {
          if (!browser.isConnected()) browser = await chromium.launch();
          // Зависший прогон (сборка встала, клик в никуда) — не ждём вечно
          let timer;
          const r = await Promise.race([
            runOnce(browser, sc, Boolean(opts.shots) && runs.length === 0, label),
            new Promise((_, rej) => {
              timer = setTimeout(() => rej(new Error('прогон дольше 150 с')), 150000);
            }),
          ]).finally(() => clearTimeout(timer));
          if (r.tainted) {
            console.log(`  ${sc.key}: прогон задет горячей перезагрузкой (${r.tainted}) — повтор`);
            continue;
          }
          runs.push(r);
        } catch (e) {
          console.log(`  ${sc.key}: прогон упал — ${String(e.message ?? e).split('\n')[0]}`);
          if (/150 с/.test(String(e.message))) await browser.close().catch(() => {});
        }
      }
      if (!runs.length) {
        put({ key: sc.key, id: sc.id, section: sc.section, device: sc.device, title: sc.title, failed: true });
        console.log(`✗ ${sc.key.padEnd(24)} не удалось измерить`);
        continue;
      }
      const sums = runs.map((r) => summarize(r, sc));
      const keys = Object.keys(sums[0]);
      const med = Object.fromEntries(keys.map((k) => [k, median(sums.map((x) => x[k]))]));
      // Подробности — из прогона, ближайшего к медиане по сумме нарушений
      const score = (x) => x.flashes * 100 + x.remounts * 10 + x.noAnim * 10 + x.pageSwap * 50;
      const target = score(med);
      const best = runs[sums.map((x) => Math.abs(score(x) - target)).reduce((bi, v, i, arr) => (v < arr[bi] ? i : bi), 0)];
      const v = verdict(med, sc);
      const row = {
        key: sc.key,
        id: sc.id,
        section: sc.section,
        device: sc.device,
        title: sc.title,
        control: Boolean(sc.control),
        newData: Boolean(sc.newData),
        navigation: Boolean(sc.navigation),
        ...med,
        ...v,
        detail: {
          skels: best.skels,
          remounts: best.remounts.slice(0, 12),
          overlays: best.overlays,
          pageSwap: best.pageSwap,
          lateShifts: best.lateShifts,
          vt: best.vt,
          fibersAtStart: best.fibersAtStart,
        },
        shots: runs[0].shots?.length ? runs[0].shots : undefined,
        problems: [...new Set(runs.flatMap((r) => r.problems))].slice(0, 5),
        raw: sums,
      };
      put(row);
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(report, null, 2));
      const mark = row.verdict === 'fail' ? '✗' : row.verdict === 'warn' ? '!' : '✓';
      console.log(
        `${mark} ${sc.key.padEnd(24)} мигания ${String(med.flashes).padStart(2)}  пересозд. ${String(med.remounts).padStart(2)}  ` +
          `рендеров ${String(med.renders).padStart(5)}  CLS ${String(Math.max(med.cls, med.clsLate)).padStart(6)}  ` +
          `оверлеев ${med.overlays} (без анимации ${med.noAnim})  ${row.fails.concat(row.warns).join('; ')}`,
      );
      if (row.problems.length) console.log(`    замечания: ${row.problems.join(' · ')}`);
    }
  } finally {
    await browser.close().catch(() => {});
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  printTable(report);
  console.log(`\nОтчёт: ${path.relative(ROOT, file)}`);
}

function printTable(report) {
  const rows = report.scenarios.filter((r) => !r.failed);
  console.log('\n' + ['сценарий'.padEnd(26), 'мигания', 'пересозд.', 'рендеры', 'CLS', 'без анимации', 'вердикт'].join(' │ '));
  for (const r of rows) {
    console.log(
      [
        r.key.padEnd(26),
        String(r.flashes).padStart(7),
        String(r.remounts).padStart(9),
        String(r.renders).padStart(7),
        String(Math.max(r.cls, r.clsLate)).padStart(3),
        String(r.noAnim).padStart(12),
        r.control ? `${r.verdict} (контроль: ${r.verdict === 'fail' ? 'пойман' : 'НЕ ПОЙМАН'})` : r.verdict,
      ].join(' │ '),
    );
  }
  const real = rows.filter((r) => !r.control);
  console.log(`\nИтого: ${real.filter((r) => r.verdict === 'fail').length} fail, ${real.filter((r) => r.verdict === 'warn').length} warn, ${real.filter((r) => r.verdict === 'ok').length} ok из ${real.length}`);
}

if (opts.list) {
  for (const s of allScenarios()) console.log(`${s.key.padEnd(26)} [${s.section}] ${s.title}  (${s.route}, ${s.persona ?? 'owner'}, ${s.device})`);
} else {
  await measure();
}
