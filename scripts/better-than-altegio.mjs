#!/usr/bin/env node
// Страница «Чем мы лучше Altegio» из docs/better-than-altegio.md (owner 29.09.2026: «должна быть всегда актуальной
// и всегда заполняться»).
//   node scripts/better-than-altegio.mjs            → .artifacts/better-than-altegio.html
// Потом Claude публикует файл в тот же артефакт: Artifact(file_path=…, url=https://claude.ai/artifact/SiGPW3DsedjFs1AozjJzRT).
// Формат пунктов в .md: «- **Название** — что это даёт (F-00-001). У Altegio: как у них.»; разделы — «## Группа»;
// «## Главное» — нумерованный список сверху. Метки: «новое, ДД.ММ.ГГГГ», «в планах».
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = join(root, 'docs/better-than-altegio.md');
const outPath = join(root, '.artifacts/better-than-altegio.html');
const src = readFileSync(srcPath, 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Конкуренты, с которыми сравниваем. Сейчас — Altegio; следующих добавить сюда и писать в .md «У <Имя>: …»
const COMPETITORS = ['Altegio'];
const LATER = 'Другие конкуренты';

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/новое, (\d{2})\.(\d{2})\.\d{4}/g, '<span class="new">новое · $1.$2</span>')
    .replace(/в планах/g, '<span class="plan">в планах</span>');
}

/** Пункт: название, что это даёт у нас, ссылки на ТЗ, как у каждого конкурента */
function parseItem(text) {
  const them = {};
  const re = new RegExp(`\\s*У (${COMPETITORS.join('|')}):\\s*`, 'g');
  const parts = text.split(re);
  let ours = parts[0];
  for (let i = 1; i < parts.length; i += 2) them[parts[i]] = cap(parts[i + 1].trim());
  const m = ours.match(/^\*\*(.+?)\*\*\s*—?\s*([\s\S]*)$/);
  const name = m ? m[1] : '';
  ours = m ? m[2] : ours;
  const refs = [];
  ours = ours.replace(/\s*\(((?:F-\d{2}-\d{3}|DESIGN\.md|ответ)[^)]*)\)/g, (_, r) => {
    refs.push(r);
    return '';
  });
  return { name, ours: cap(ours.replace(/^[:\s]+/, '').trim()), refs: refs.join(', '), them };
}

// Разбор: «## Раздел», пункты «- …» / «1. …» с продолжением строк через отступ
const sections = [];
let cur = null;
let buf = null;
const flush = () => {
  if (buf && cur) cur.items.push(parseItem(buf.join(' ')));
  buf = null;
};
for (const line of src.split('\n')) {
  if (line.startsWith('## ')) {
    flush();
    cur = { title: line.slice(3).trim(), items: [] };
    sections.push(cur);
    continue;
  }
  if (!cur) continue;
  const m = line.match(/^(?:- |\d+\. )(.*)$/);
  if (m) {
    flush();
    buf = [m[1].trim()];
  } else if (buf && line.startsWith('  ')) buf.push(line.trim());
  else if (['', '---'].includes(line.trim())) flush();
}
flush();

const top = sections.find((s) => s.title === 'Главное');
const groups = sections.filter((s) => s !== top);
const total = groups.reduce((n, s) => n + s.items.length, 0);
const withThem = groups.reduce((n, s) => n + s.items.filter((i) => Object.keys(i.them).length).length, 0);
const updated = statSync(srcPath).mtime.toLocaleDateString('ru-RU', { timeZone: 'Asia/Yerevan' });
const pad = (n) => String(n).padStart(2, '0');
const slidesTotal = groups.length + 3;

const themCells = (it) =>
  COMPETITORS.map(
    (c) => `<div class="them" data-comp="${esc(c)}">${it.them[c] ? inline(it.them[c]) : '<span class="none">—</span>'}</div>`,
  ).join('');

const topCards = top
  ? top.items
      .map(
        (it, i) => `<article class="hl">
  <span class="hl-n">${i + 1}</span>
  <h3>${inline(it.name)}</h3>
  <div class="hl-cols">
    <div><span class="who us">BookTime</span><p>${inline(it.ours)}</p></div>
    ${COMPETITORS.map((c) => `<div data-comp="${esc(c)}"><span class="who">${esc(c)}</span><p>${it.them[c] ? inline(it.them[c]) : '<span class="none">—</span>'}</p></div>`).join('')}
  </div>
</article>`,
      )
      .join('')
  : '';

const groupSlides = groups
  .map(
    (g, gi) => `<section class="slide" id="g${gi}">
  <div class="slide-head"><span class="slide-no">${pad(gi + 3)} / ${pad(slidesTotal)}</span><h2>${esc(g.title)}</h2><span class="slide-count">${g.items.length} ${g.items.length % 10 === 1 && g.items.length % 100 !== 11 ? 'пункт' : g.items.length % 10 >= 2 && g.items.length % 10 <= 4 && (g.items.length % 100 < 12 || g.items.length % 100 > 14) ? 'пункта' : 'пунктов'}</span></div>
  <div class="rows">
    <div class="row row-head" aria-hidden="true"><div>Что</div><div>BookTime</div>${COMPETITORS.map((c) => `<div data-comp="${esc(c)}">${esc(c)}</div>`).join('')}</div>
    ${g.items
      .map(
        (it) => `<div class="row"><div class="what">${inline(it.name)}${it.refs ? `<span class="ref">${esc(it.refs)}</span>` : ''}</div><div class="ours">${inline(it.ours)}</div>${themCells(it)}</div>`,
      )
      .join('')}
  </div>
</section>`,
  )
  .join('\n');

const toc = groups.map((g, i) => `<a href="#g${i}"><span>${pad(i + 3)}</span>${esc(g.title)}<b>${g.items.length}</b></a>`).join('');
const tabs = [...COMPETITORS.map((c, i) => `<button type="button" class="tab" data-tab="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`), `<button type="button" class="tab" disabled>${LATER} — скоро</button>`].join('');

const DARK = `color-scheme:dark; --paper:#100E1E; --surface:#1A1830; --surface-2:#232040; --line:#2E2A4C; --ink:#EEECF8; --muted:#A4A0BE;
  --accent:#8F84FF; --accent-ink:#B9B2FF; --accent-soft:#262157; --cover:#1D1760; --cover-ink:#F2F0FF; --cover-muted:#B8B2F0;
  --new:#5FD39E; --new-soft:#173327; --plan:#E7B84B; --plan-soft:#3A2E12;`;

const page = `<title>Чем мы лучше Altegio</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700&family=Onest:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>
:root { --paper:#F6F5FB; --surface:#FFFFFF; --surface-2:#EFEDF8; --line:#E1DDF1; --ink:#16132C; --muted:#67637E;
  --accent:#5B4BE6; --accent-ink:#4234C6; --accent-soft:#ECE9FF; --cover:#241C7A; --cover-ink:#FFFFFF; --cover-muted:#C9C3FF;
  --new:#1F8A5B; --new-soft:#E3F5EC; --plan:#9A6A00; --plan-soft:#FBF0D6;
  --display: Unbounded, "Arial Black", system-ui, sans-serif; --body: Onest, "Segoe UI", system-ui, sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${DARK} } }
:root[data-theme="dark"] { ${DARK} }
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior:auto; } }
body { background:var(--paper); color:var(--ink); font:16px/1.55 var(--body); padding-inline:16px; padding-block:16px 48px; }
.deck { max-width:1200px; margin:0 auto; display:flex; flex-direction:column; gap:20px; }
.slide { background:var(--surface); border:1px solid var(--line); border-radius:28px; padding:clamp(24px,5vw,56px); display:flex; flex-direction:column; gap:28px; scroll-margin-top:16px; }
.slide-head { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 18px; }
.slide-no { font:500 13px var(--body); letter-spacing:.12em; color:var(--muted); font-variant-numeric:tabular-nums; }
h1, h2, h3 { text-wrap:balance; margin:0; }
h2 { font:600 clamp(24px,3.6vw,38px)/1.1 var(--display); letter-spacing:-.01em; flex:1 1 320px; }
.slide-count { color:var(--muted); font-size:15px; }
/* Обложка */
.cover { background:var(--cover); color:var(--cover-ink); border:0; gap:36px; }
.cover .slide-no { color:var(--cover-muted); }
.brand { font:700 18px var(--display); letter-spacing:.02em; display:flex; align-items:center; gap:10px; }
.brand i { width:30px; height:30px; border-radius:9px; background:var(--cover-ink); color:var(--cover); display:grid; place-items:center; font-style:normal; font-size:16px; }
.cover h1 { font:700 clamp(32px,6vw,68px)/1.02 var(--display); letter-spacing:-.02em; max-width:15ch; }
.cover .lede { font-size:clamp(17px,2vw,20px); color:var(--cover-muted); max-width:58ch; margin:0; }
.stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1px; background:color-mix(in srgb, var(--cover-ink) 18%, transparent); border-radius:18px; overflow:hidden; }
.stats div { background:var(--cover); padding:18px 20px; display:flex; flex-direction:column; gap:4px; }
.stats b { font:700 clamp(28px,4vw,44px)/1 var(--display); font-variant-numeric:tabular-nums; }
.stats span { color:var(--cover-muted); font-size:14px; }
.vs { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.vs > span { color:var(--cover-muted); font-size:14px; margin-right:4px; }
.tab { font:600 14px var(--body); border-radius:999px; padding:9px 16px; border:1px solid color-mix(in srgb, var(--cover-ink) 35%, transparent); background:transparent; color:var(--cover-ink); cursor:pointer; }
.tab[aria-pressed="true"] { background:var(--cover-ink); color:var(--cover); border-color:var(--cover-ink); }
.tab:disabled { opacity:.55; cursor:default; }
.tab:focus-visible, .toc a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
/* Главное */
.hl-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr)); gap:16px; }
.hl { border:1px solid var(--line); border-radius:20px; padding:22px; display:flex; flex-direction:column; gap:14px; background:var(--paper); position:relative; }
.hl-n { font:700 40px/1 var(--display); color:var(--accent); }
.hl h3 { font:600 19px/1.25 var(--display); }
.hl-cols { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.hl-cols p { margin:6px 0 0; font-size:15px; }
.hl-cols > div + div { border-left:1px solid var(--line); padding-left:14px; }
.hl-cols > div + div p { color:var(--muted); }
.who { font:600 11px var(--body); letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.who.us { color:var(--accent-ink); }
/* Таблица группы */
.rows { display:flex; flex-direction:column; }
.row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr); gap:24px; padding:16px 0; border-top:1px solid var(--line); }
.row-head { border-top:0; padding-top:0; font:600 11px var(--body); letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
.row-head div:nth-child(2) { color:var(--accent-ink); }
.what { font-weight:600; display:flex; flex-direction:column; gap:4px; }
.ours { font-size:15px; }
.them { font-size:15px; color:var(--muted); }
.none { color:var(--muted); opacity:.7; font-style:italic; font-size:14px; }
.ref { font:500 11px/1.4 "JetBrains Mono", ui-monospace, monospace; color:var(--muted); font-weight:500; }
.new { font:600 12px var(--body); background:var(--new-soft); color:var(--new); border-radius:6px; padding:2px 7px; white-space:nowrap; }
.plan { font:600 12px var(--body); background:var(--plan-soft); color:var(--plan); border-radius:6px; padding:2px 7px; white-space:nowrap; }
/* Оглавление */
.toc { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:8px; }
.toc a { display:flex; align-items:center; gap:12px; padding:14px 16px; border:1px solid var(--line); border-radius:14px; color:var(--ink); text-decoration:none; font-weight:500; background:var(--paper); }
.toc a:hover { border-color:var(--accent); }
.toc a span { font:600 13px var(--display); color:var(--accent-ink); }
.toc a b { margin-left:auto; color:var(--muted); font-weight:500; font-variant-numeric:tabular-nums; }
.closing p { margin:0; max-width:62ch; color:var(--muted); font-size:17px; }
.closing ul { margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px; color:var(--muted); }
[data-comp][hidden] { display:none !important; }
@media (max-width:760px) {
  .stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .row { grid-template-columns:1fr; gap:6px; }
  .row-head { display:none; }
  .them::before { content:attr(data-comp) " · "; font-weight:600; }
  .hl-cols { grid-template-columns:1fr; }
  .hl-cols > div + div { border-left:0; padding-left:0; border-top:1px solid var(--line); padding-top:12px; }
}
</style>
<main class="deck">
  <section class="slide cover" id="cover">
    <span class="slide-no">01 / ${pad(slidesTotal)} · обновлено ${updated}</span>
    <div class="brand"><i>B</i>BookTime</div>
    <h1>Всё, что умеет Altegio, — и ${total} причин выбрать нас</h1>
    <p class="lede">Платформа записи к мастерам для Армении. Функции Altegio повторяем один к одному, а сверху — то, чего у них нет или что у нас удобнее: для клиентов, мастеров, администраторов и владельцев.</p>
    <div class="stats">
      <div><b>${total}</b><span>преимуществ</span></div>
      <div><b>${groups.length}</b><span>областей продукта</span></div>
      <div><b>${withThem}</b><span>с прямым сравнением</span></div>
      <div><b>${top?.items.length ?? 0}</b><span>главных — на следующем слайде</span></div>
    </div>
    <div class="vs"><span>Сравнение с</span>${tabs}</div>
  </section>

  <section class="slide" id="top">
    <div class="slide-head"><span class="slide-no">02 / ${pad(slidesTotal)}</span><h2>Главное</h2><span class="slide-count">то, ради чего переходят</span></div>
    <div class="hl-grid">${topCards}</div>
  </section>

  <section class="slide" id="toc">
    <div class="slide-head"><h2>Все преимущества по областям</h2></div>
    <nav class="toc" aria-label="Области">${toc}</nav>
  </section>

${groupSlides}

  <section class="slide closing" id="next">
    <div class="slide-head"><span class="slide-no">${pad(slidesTotal)} / ${pad(slidesTotal)}</span><h2>Дальше</h2></div>
    <p>Страница собирается из списка в проекте и обновляется после каждой доработки. Следующий шаг — сравнение с другими конкурентами в этой же презентации: переключатель на обложке.</p>
    <ul>
      <li>Без пометки — работает в интерфейсе на демо-данных, настоящий сервер подключаем следом.</li>
      <li><span class="new">новое · дата</span> — сделано недавно, <span class="plan">в планах</span> — решено, но ещё не сделано.</li>
      <li>Под названием пункта — номер функции в ТЗ, чтобы найти подробности.</li>
    </ul>
  </section>
</main>
<script>
(() => {
  const tabs = [...document.querySelectorAll('.tab[data-tab]')];
  const show = (name) => {
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.tab === name)));
    document.querySelectorAll('[data-comp]').forEach((el) => { el.hidden = el.dataset.comp !== name; });
    try { localStorage.setItem('btl-comp', name); } catch {}
  };
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  let saved = null;
  try { saved = localStorage.getItem('btl-comp'); } catch {}
  show(tabs.some((t) => t.dataset.tab === saved) ? saved : tabs[0]?.dataset.tab);
})();
</script>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, page);
console.log(`✓ ${outPath} — ${total} пунктов в ${groups.length} группах (у ${withThem} есть «как у Altegio»), главное: ${top?.items.length ?? 0}, обновлено ${updated}`);
