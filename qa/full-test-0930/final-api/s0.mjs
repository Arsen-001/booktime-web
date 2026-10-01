export default async ({ go, shot, text, page }) => {
  await go('/biz/journal');
  const t = await text();
  await shot('s0-journal');
  const hrefs = await page.$$eval('a[href^="/biz"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  return { url: page.url(), t: t.slice(0, 600), hrefs };
};
