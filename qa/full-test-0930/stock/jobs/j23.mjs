export default async (t, log) => {
  const p = t.page;
  await t.go('owner', '/biz/stock/order');
  const inp = p.getByLabel(/Номер поставщика/);
  await inp.click(); await inp.pressSequentially('91234567', { delay: 30 }); await p.waitForTimeout(500);
  log('phone value', await inp.inputValue());
  const wa = p.getByRole('button', { name: /WhatsApp/ });
  log('disabled', await wa.isDisabled());
  log('qty inputs', await p.locator('main input[inputmode], main input[type=text]').evaluateAll(es => es.map(e => e.value)));
  const [popup] = await Promise.all([p.context().waitForEvent('page', { timeout: 10000 }).catch(() => null), wa.click()]);
  log('wa:', popup ? decodeURIComponent(popup.url()).replace(/\+/g,' ') : 'none ' + p.url());
  if (popup) await popup.close();
};
