#!/usr/bin/env node
/**
 * Проверка длины полей в docs/store/listing-*.md: у каждого поля в заголовке «(≤ N)», ниже — блок ```text.
 * Если у поля лимита нет, берётся лимит по названию поля (название ≤ 30 и т. д.).
 *   node docs/store/check-limits.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const BY_NAME = [
  [/^(Название|Name|Անվանում)/, 30],
  [/^(Подзаголовок|Subtitle)/, 30],
  [/^(Краткое|Short|Կարճ)/, 80],
  [/^(Ключевые|Keywords)/, 100],
  [/^Promotional/, 170],
  [/^(Описание|Description|Նկարագրություն)/, 4000],
  [/^(Что нового|What’s new|Ինչ նոր)/, 500],
];
let bad = 0;
for (const file of fs.readdirSync(dir).filter((f) => /^listing-.*\.md$/.test(f))) {
  const text = fs.readFileSync(path.join(dir, file), 'utf8');
  let section = '';
  const re = /^## (.+)$|^\*\*(.+?)\*\*(.*)\n```text\n([\s\S]*?)\n```/gm;
  for (const m of text.matchAll(re)) {
    if (m[1]) {
      section = m[1].split(' ')[0];
      continue;
    }
    const field = m[2];
    const explicit = /≤\s*(\d+)/.exec(m[2] + m[3]);
    const limit = explicit ? Number(explicit[1]) : BY_NAME.find(([r]) => r.test(field))?.[1];
    const len = [...m[4]].length;
    const ok = !limit || len <= limit;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${file} · ${section} · ${field}: ${len}${limit ? ` / ${limit}` : ''}`);
  }
}
process.exit(bad ? 1 : 0);
