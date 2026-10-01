export default async (t, log) => {
  await t.go('owner', '/biz/finance');
  const ft = (await t.text()).replace(/[  ]/g, ' ');
  const i = ft.indexOf('5 600');
  log('finance sale row:', i >= 0 ? ft.slice(Math.max(0,i-200), i+30).replace(/\s+/g,' ') : 'NOT FOUND');
};
