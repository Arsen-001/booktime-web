export default async ({ go, shot, page, text }) => {
  const r = {};
  for (const p of (process.env.PAGES || '/biz/apps').split(',')) {
    await go(p, 3500);
    const n = p.replace(/\W+/g, '_');
    await shot('a1' + n);
    r[p] = (await text()).slice(0, 350);
  }
  return r;
};
