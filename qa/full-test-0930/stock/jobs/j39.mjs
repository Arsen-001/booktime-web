const norm = (s) => s.replace(/[\u00a0\u202f]/g, ' ');
export default async (t, log) => {
  const browser = t.ctx.browser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const go = async (r) => { await p.goto(`http://localhost:3710${r}${r.includes('?')?'&':'?'}demo=owner&lang=ru&api=normal`, { waitUntil: 'domcontentloaded', timeout: 300000 }); await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{}); await p.waitForTimeout(2500); };
  await go('/biz/stock/operations?type=sale');
  let rows = await p.locator('main tr').allInnerTexts();
  log('ops sale rows:', rows.map(norm).filter(r => /Продажа товара/.test(r)).map(r => r.replace(/\s+/g,' ').slice(0,150)));
  await go('/biz/finance');
  const ft = norm(await p.locator('main').innerText());
  log('finance:', [...ft.matchAll(/(\d\d\.\d\d\.\d{4}, \d\d:\d\d)[^]{0,40}?Продажа товаров[^]*?([+−][\d ]+֏)/g)].map(m => m[0].replace(/\s+/g,' ').slice(0, 160)));
  await ctx.close();
};
