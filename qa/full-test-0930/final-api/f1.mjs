export default async ({ go, shot, page, text }) => {
  const r = {};
  await go('/biz/finance/shift', 4000);
  await shot('f1-shift');
  r.t = (await text()).slice(0, 700);
  const open = page.getByRole('button', { name: 'Открыть смену' }).first();
  r.canOpen = await open.count();
  if (r.canOpen) {
    await open.click(); await page.waitForTimeout(1500);
    const d = page.locator('[role=dialog]').last();
    r.openDlg = (await d.innerText()).slice(0, 300);
    await shot('f1-open-dlg', false);
    const exp1 = (r.openDlg.match(/должно быть\s*([\d\s ]+)/i)?.[1] || '0').replace(/\D/g, '');
    r.exp1 = exp1;
    await d.locator('input').first().fill(exp1);
    await page.waitForTimeout(500);
    await d.getByRole('button', { name: 'Открыть смену' }).click(); await page.waitForTimeout(3000);
    r.afterOpen = (await text()).slice(0, 500);
    await shot('f1-opened');
    await page.getByRole('button', { name: 'Закрыть смену' }).first().click(); await page.waitForTimeout(1500);
    const d2 = page.locator('[role=dialog]').last();
    r.closeDlg = (await d2.innerText()).slice(0, 400);
    await shot('f1-close-dlg', false);
    const exp2 = (r.closeDlg.match(/должно быть\s*([\d\s ]+)/i)?.[1] || '0').replace(/\D/g, '');
    r.exp2 = exp2;
    await d2.locator('input').first().fill(exp2);
    await page.waitForTimeout(500);
    r.closeDlg2 = (await d2.innerText()).slice(0, 400);
    await d2.getByRole('button', { name: 'Закрыть смену' }).click(); await page.waitForTimeout(3000);
    r.afterClose = (await text()).slice(0, 900);
    await shot('f1-closed');
  }
  return r;
};
