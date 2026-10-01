export default async (t, log) => {
  const p = t.page;
  for (const lang of ['ru','en']) {
    t.lang = lang;
    await t.go('owner', '/biz/stock/order');
    await p.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
    const inp = p.getByLabel(/Номер поставщика|WhatsApp number/);
    await inp.click(); await inp.pressSequentially('91234567', { delay: 30 }); await p.waitForTimeout(400);
    await p.getByRole('button', { name: /WhatsApp/ }).click(); await p.waitForTimeout(500);
    log(lang, (await p.evaluate(() => window.__opened)).map(u => decodeURIComponent(u)));
  }
  t.lang = 'ru';
};
