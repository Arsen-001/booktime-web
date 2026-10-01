const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  t.lang = 'en';
  await t.go('master', '/biz/stock/goods/new', 'phone');
  log('en master:', norm(await t.text()).replace(/\n+/g, ' | ').slice(0, 150));
  await t.shot('k-noaccess-en-phone');
  await t.go('owner', '/biz/stock', 'phone');
  await p.getByRole('button', { name: 'Notifications' }).first().click(); await p.waitForTimeout(1200);
  log('en bell:', norm(await p.locator('[data-f="F-00-137"]').first().innerText().catch(() => 'NONE')).replace(/\n+/g, ' | '));
  await t.shot('k-bell-en-phone');
  t.lang = 'ru';
  await t.go('owner', '/biz/stock', 'phone');
};
