export default async (t, log) => {
  const p = t.page;
  await p.getByLabel(/^Клиент/).fill('Диана'); await p.waitForTimeout(1500);
  const opts = await p.getByRole('option').allInnerTexts(); log('client opts', opts.slice(0,4));
  await p.getByRole('option').first().click(); await p.waitForTimeout(400);
  const q = p.getByPlaceholder('Название, артикул или штрихкод');
  await q.fill('2542039189021'); await p.waitForTimeout(1000); await q.press('Enter'); await p.waitForTimeout(1000);
  log(await p.evaluate(() => [...document.querySelectorAll('main input')].filter(e=>e.getClientRects().length).map(e => (e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||'').trim()+'='+e.value)));
  const qty = p.getByLabel(/^Количество/).first();
  await qty.fill('2'); await p.waitForTimeout(400);
  log('totals', (await t.text()).match(/Итого[^\n]*\n?[^\n]*/g));
  await t.shot('sale-filled', true);
  await p.getByRole('button', { name: 'Сохранить и оплатить' }).click();
  await p.waitForTimeout(2500);
  const dlg = p.locator('[role=dialog]').filter({ visible: true }).last();
  log('PAY DIALOG', (await dlg.innerText().catch(()=>'none')).replace(/\n+/g,' | ').slice(0, 900));
  await t.shot('sale-pay-dialog');
};
