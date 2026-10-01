const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/finance');
  const x = norm(await t.text());
  log(x.replace(/\n+/g, ' | ').slice(0, 1800));
};
