// Поиск сырых цветов в коде: в компонентах допускаются ТОЛЬКО токены (bg-surface, text-muted, …).
//
//   node scripts/check-tokens.mjs                 — весь src/**
//   node scripts/check-tokens.mjs --area journal  — только пути раздела (src/areas/journal/** + его маршруты)
//
// Ищет: #rgb/#rrggbb/#rrggbbaa, rgb()/rgba()/hsl()/hsla()/oklch()/lab(), классы Tailwind с произвольным
// цветом (bg-[#…], text-[rgb(…)], border-[hsl…]) и стандартную палитру Tailwind (bg-white, text-black,
// bg-gray-100, text-red-500 …) — её в проекте нет, класс просто не сработает.
// Не проверяет: src/styles/tokens.css, src/app/globals.css, src/mock/seed/** (данные).
// Строка с комментарием `tokens-ok` пропускается (например, цвет ИЗ ДАННЫХ — оттенок лака).
// Выход 1, если что-то найдено.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const areaIndex = args.indexOf('--area');
const area = areaIndex >= 0 ? args[areaIndex + 1] : undefined;

const EXCLUDE = ['src/styles/tokens.css', 'src/app/globals.css'];
const EXCLUDE_DIRS = ['src/mock/seed/'];

let roots = [path.join(ROOT, 'src')];
if (area) {
  const areas = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/areas.json'), 'utf8')).areas;
  const info = areas.find((a) => a.id === area);
  if (!info) {
    console.error(`Нет раздела «${area}»`);
    process.exit(2);
  }
  roots = [
    path.join(ROOT, 'src/areas', area),
    ...info.routes.map((r) => path.join(ROOT, r.replace(/\/\*\*$/, ''))),
    path.join(ROOT, `src/domain/${area}.ts`),
    path.join(ROOT, `src/mock/slices/${area}.ts`),
    path.join(ROOT, `src/api/${area}.ts`),
  ];
}

const PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const UTILS = 'bg|text|border|ring|outline|fill|stroke|from|via|to|divide|placeholder|decoration|caret|accent|shadow|ring-offset|border-[trblxy]|border-[se]';
const RULES = [
  { name: 'hex', re: /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g },
  { name: 'css-color-fn', re: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g },
  { name: 'arbitrary-color', re: new RegExp(`\\b(?:${UTILS})-\\[(?:#|rgb|hsl|oklch|color:)`, 'g') },
  { name: 'tailwind-palette', re: new RegExp(`(?<![\\w-])(?:[a-z-]+:)*(?:${UTILS})-(?:(?:${PALETTE})-\\d{2,3}|white|black)(?:\\/\\d+)?(?![\\w-])`, 'g') },
];

const found = [];
function scanFile(file) {
  const rel = path.relative(ROOT, file);
  if (EXCLUDE.includes(rel) || EXCLUDE_DIRS.some((d) => rel.startsWith(d))) return;
  if (!/\.(tsx?|jsx?|css|mjs)$/.test(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('tokens-ok')) return;
    const trimmed = line.trim();
    // Комментарии и импорты не проверяем (там бывают #-ссылки на задачи)
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('import ')) return;
    const code = line.replace(/\s\/\/\s.*$/, '');
    for (const rule of RULES) {
      for (const m of code.matchAll(rule.re)) {
        // #id в URL-якорях (href="#main") и &#x…; не цвета
        if (rule.name === 'hex' && /href=|#main|#content/.test(code.slice(Math.max(0, m.index - 12), m.index + 8))) continue;
        found.push({ file: rel, line: i + 1, rule: rule.name, match: m[0], text: trimmed.slice(0, 140) });
      }
    }
  });
}
function walk(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isFile()) return scanFile(p);
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    walk(path.join(p, entry.name));
  }
}
roots.forEach(walk);

if (!found.length) {
  console.log(`✓ сырых цветов нет${area ? ` (раздел ${area})` : ''}`);
} else {
  for (const f of found) console.log(`${f.file}:${f.line}  [${f.rule}] ${f.match}   ${f.text}`);
  console.log(`\n✗ найдено: ${found.length}. В компонентах — только токены (src/styles/tokens.css). Цвет из данных — пометьте строку комментарием tokens-ok.`);
  process.exitCode = 1;
}
