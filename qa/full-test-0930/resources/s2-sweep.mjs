// Обход всех экранов раздела: персоны, пусто, ошибка, телефон/десктоп, en; текст + ошибки консоли + снимки
import { start, stop, ctx, open, shot } from './lib.mjs';
import fs from 'node:fs';
const routes = ['/biz/resources', '/biz/resources/new', '/biz/resources/packages', '/biz/resources/packages/new', '/biz/resources/assistants', '/biz/groups', '/biz/groups/events/new', '/biz/groups/settings', '/biz/waitlist'];
const G = ['/biz/groups', '/biz/groups/events/new', '/biz/groups/settings'];
const runs = [
  { persona: 'owner', device: 'phone', only: routes.filter((r) => !r.includes('/biz/resources/') || true).slice(1) },
  { persona: 'owner', device: 'desktop', query: 'sphere=fitness', tag: 'fit', only: G },
  { persona: 'owner', device: 'phone', query: 'sphere=fitness', tag: 'fit', only: G },
  { persona: 'master', device: 'phone', query: 'sphere=fitness', tag: 'fit', only: ['/biz/groups'] },
  { persona: 'owner', device: 'desktop', lang: 'en', only: ['/biz/resources', '/biz/groups', '/biz/waitlist', '/biz/resources/packages'] },
  { persona: 'admin', device: 'phone', only: ['/biz/resources', '/biz/groups', '/biz/waitlist'] },
  { persona: 'master', device: 'phone', only: ['/biz/resources', '/biz/groups', '/biz/waitlist'] },
  { persona: 'individual', device: 'phone', only: ['/biz/resources', '/biz/groups', '/biz/waitlist'] },
  { persona: 'owner', device: 'phone', query: 'empty=1', tag: 'empty', only: ['/biz/resources', '/biz/resources/packages', '/biz/groups', '/biz/waitlist', '/biz/resources/assistants'] },
  { persona: 'owner', device: 'desktop', query: 'api=error', tag: 'err', only: ['/biz/resources', '/biz/groups', '/biz/waitlist', '/biz/resources/packages'] },
];
const out = [];
await start();
try {
  for (const r of runs) {
    const c = await ctx({ device: r.device });
    let first = true;
    for (const route of r.only ?? routes) {
      let p;
      try { p = await open(c, route, { persona: r.persona, lang: r.lang ?? 'ru', query: r.query ?? '' }); } catch (e) { out.push({ name: route + ' ' + r.persona, url: route, errors: ['TIMEOUT ' + e.message.slice(0, 80)], raw: [], overflow: false, text: '' }); continue; }
      first = false;
      await p.waitForTimeout(r.query === 'api=error' ? 2500 : 500);
      const name = `s2-${route.replace(/\//g, '_')}-${r.persona}-${r.device}-${r.lang ?? 'ru'}${r.tag ? '-' + r.tag : ''}`;
      await shot(p, name);
      const text = (await p.locator('main').innerText().catch(() => p.locator('body').innerText())).replace(/\s+/g, ' ').slice(0, 600);
      const raw = text.match(/\b[a-z]+\.[a-zA-Z]+\.[a-zA-Z.]+\b/g) ?? [];
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      out.push({ name, url: p.url(), errors: p.errors.splice(0), raw, overflow, text });
    }
    await c.close();
  }
} finally { await stop(); fs.writeFileSync(new URL('./s2b-sweep.json', import.meta.url), JSON.stringify(out, null, 1)); }
for (const o of out) console.log(`${o.name} | ${o.url.replace('http://localhost:3710', '')} | err=${o.errors.length} raw=${o.raw.join(',')} ovf=${o.overflow}\n   ${o.text.slice(0, 220)}`);
