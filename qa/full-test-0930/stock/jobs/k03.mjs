const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/finance/counterparties');
  log('cp page:', norm(await t.text()).slice(0, 120).replace(/\n+/g,' | '));
  log('BTN', (await t.buttons()).slice(0, 8));
};
