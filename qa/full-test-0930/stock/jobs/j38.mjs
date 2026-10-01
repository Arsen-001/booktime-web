const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/finance');
  const rows = await p.locator('main tr').allInnerTexts();
  log('finance rows with goods:', rows.map(norm).filter(r => /Продажа товаров/.test(r)).map(r => r.replace(/\s+/g,' ')));
  await t.go('owner', '/biz/stock/operations');
  const orows = await p.locator('main tr').allInnerTexts();
  log('ops sale rows:', orows.map(norm).filter(r => /Продажа товара/.test(r)).map(r => r.replace(/\s+/g,' ').slice(0,150)));
  log('ops count', norm(await t.text()).match(/Найдено документов\s*(\d+)/)?.[1]);
};
