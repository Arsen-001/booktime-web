// Обход всех статических маршрутов сети: ru телефон+десктоп, en десктоп; снимки + audit + ошибки консоли
import { connect, newPage, go, shot, audit, text } from './h.mjs';
const ROUTES = process.argv[2]?.split(',') ?? ['/biz/network','/biz/network/switch','/biz/network/new','/biz/network/settings','/biz/network/settings/users','/biz/network/settings/plans','/biz/network/settings/fields','/biz/network/clients','/biz/network/clients/log','/biz/network/records','/biz/network/analytics','/biz/network/staff','/biz/network/staff/new','/biz/network/staff/positions','/biz/network/staff/off-days','/biz/network/staff/payroll','/biz/network/staff/migration','/biz/network/services','/biz/network/services/subdivisions','/biz/network/services/migration','/biz/network/goods','/biz/network/goods/archive','/biz/network/goods/stock','/biz/network/goods/migration','/biz/network/loyalty','/biz/network/telephony'];
const COMBOS = (process.argv[3] ?? 'desktop-ru,phone-ru,desktop-en').split(',');
const persona = process.argv[4] ?? 'network';
const browser = await connect();
for (const combo of COMBOS) {
  const [device, lang] = combo.split('-');
  const { ctx, page, errors } = await newPage(browser, { device, lang });
  for (const r of ROUTES) {
    errors.length = 0;
    try { await go(page, r, { lang, persona }); } catch (e) { console.log('GOTO FAIL', r, e.message.slice(0, 100)); continue; }
    const a = await audit(page);
    const name = `sweep/${r.replace(/^\/biz\/network\/?/, '').replace(/\//g, '_') || 'overview'}__${persona}-${combo}`;
    await shot(page, name);
    const t = (await text(page)).slice(0, 0);
    const bad = errors.filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(e));
    console.log(`${combo} ${r} raw=${a.raw.join('|')} overflow=${a.overflow} small=${a.small.join('|')} title=${a.titled.join('|')} errs=${bad.length ? bad.join(' || ') : 0}${t}`);
  }
  await ctx.close();
}
await browser.close();
