import { rowHrefs } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients/steps/rowhref.mjs';
// en/hy главные экраны, сырые ключи, подэкраны на телефоне
export default async ({ page, go, shot, text }) => {
  const r = {};
  const raw = (t) => (t.match(/\b[a-z]+[A-Z]?[a-zA-Z]*\.[a-zA-Z.]+\b/g) || []).filter((s) => !/\.(am|com|ru|csv|xlsx|png)$/.test(s)).slice(0, 10);
  for (const lang of ['en', 'hy']) {
    await go('/biz/clients', { lang });
    let t = await text(); r[`${lang}-list`] = { head: t.slice(0, 300), raw: raw(t) };
    await shot(`s11-${lang}-list`);
    const href = (await rowHrefs(page, 1))[0] ?? null;
    if (href) { await go(href, { lang }); t = await text(); r[`${lang}-card`] = { head: t.slice(0, 400), raw: raw(t) }; await shot(`s11-${lang}-card`); }
  }
  for (const route of ['/biz/clients/summary', '/biz/clients/categories', '/biz/clients/import', '/biz/clients/log', '/biz/clients/consent', '/biz/clients/loyalty', '/biz/clients/integrations']) {
    for (const device of ['phone', 'desktop']) {
      await go(route, { lang: 'ru', device });
      const t = await text();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      r[`${route}-${device}`] = { head: t.slice(0, 200).replace(/\n/g, ' | '), raw: raw(t), overflow };
      await shot(`s11${route.replace(/\//g, '_')}-${device}`);
    }
  }
  return r;
};
