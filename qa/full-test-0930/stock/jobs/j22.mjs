const norm = (s) => s.replace(/[  ]/g, ' ');
export default async (t, log) => {
  const p = t.page;
  for (const lang of ['ru', 'en']) {
    t.lang = lang;
    await t.go('owner', '/biz/stock/order');
    log(lang, 'order:', norm(await t.text()).replace(/\n+/g,' | ').slice(0, 400));
    await p.getByLabel(/Номер поставщика|WhatsApp number/).fill('91 234567');
    const wa = p.getByRole('button', { name: /WhatsApp/ });
    const [popup] = await Promise.all([p.context().waitForEvent('page', { timeout: 8000 }).catch(() => null), wa.click()]);
    log(lang, 'wa:', popup ? decodeURIComponent(popup.url()).replace(/\+/g,' ') : 'none');
    if (popup) await popup.close();
    await t.shot(`order-${lang}-after-fix`);
  }
  t.lang = 'ru';
};
