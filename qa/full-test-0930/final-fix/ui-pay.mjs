// Окно записи журнала: «Оплатить» наличными → частичный возврат 1 000 → вкладка «Оплата» (finance) → отмена платежа → касса
const LABEL = process.env.LABEL ?? '10:15–11:00, Нелли Г., Маникюр классический, Записан';
export default async ({ page, go, shot, device }) => {
  const r = {};
  const P = process.env.MODE === 'mock' ? 'demo=owner&' : '';
  const dlg = () => page.locator('[role=dialog]').last();
  const modalText = async () => (await dlg().innerText()).replace(/\s+/g, ' ').slice(0, 420);
  if (process.env.BK) await go(`/biz/journal?${P}date=${process.env.DATE}&booking=${process.env.BK}`, 5000);
  else { await go(`/biz/journal?${P}date=2026-10-02`, 5000); await page.locator(`[aria-label="${LABEL}"]`).first().click(); await page.waitForTimeout(3000); }
  r.url = page.url();
  await dlg().getByRole('button', { name: /^Оплатить/ }).last().click();
  await page.waitForTimeout(2000);
  r.sheet0 = await modalText();
  await dlg().getByRole('button', { name: /^Наличные/ }).first().click();
  await page.waitForTimeout(3500);
  r.afterPay = await modalText();
  await shot('pay-1-paid', false);
  await dlg().getByRole('button', { name: 'Частичный возврат' }).first().click();
  await page.waitForTimeout(500);
  await dlg().locator('input').first().fill('1000');
  await dlg().getByRole('button', { name: /^Вернуть$/ }).click();
  await page.waitForTimeout(3500);
  r.afterRefund = await modalText();
  await shot('pay-2-refund', false);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  r.windowAfterRefund = await modalText();
  await shot('pay-3-window', false);
  // вкладка «Оплата» (finance) в окне
  const tab = dlg().getByRole('tab', { name: /^Оплата/ });
  if (await tab.count()) { await tab.first().click(); await page.waitForTimeout(3000); r.financeTab = await modalText(); await shot('pay-4-finance-tab', false); }
  // касса: «Финансы → Операции» — строки этого визита
  const ops = async (name) => { const back = page.url(); await go(`/biz/finance?${P}`.replace(/[?&]$/, ''), 5000); await shot(name); const t = (await page.innerText('main')).split('\n').filter((l) => /Нелли|QA Финал|Возврат|Оплата услуги/.test(l)).slice(0, 12); await go(back.replace('http://localhost:3710', ''), 5000); return t; };
  r.opsAfterRefund = await ops('pay-ops-after-refund');
  // отмена платежа из «Оплаты визита»
  const tabMain = dlg().getByRole('tab').first(); await tabMain.click().catch(() => {}); await page.waitForTimeout(1000);
  await dlg().getByRole('button', { name: /^Оплатить|Оплачено|оплачен/i }).last().click().catch((e) => { r.reopenErr = String(e).slice(0, 120); });
  await page.waitForTimeout(2000);
  r.sheetBeforeCancel = await modalText();
  await dlg().getByRole('button', { name: 'Отменить платёж' }).first().click();
  await page.waitForTimeout(3500);
  r.afterCancel = await modalText();
  await shot('pay-5-cancelled', false);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  r.opsAfterCancel = await ops('pay-ops-after-cancel');
  if (await tab.count()) { await tab.first().click(); await page.waitForTimeout(3000); r.financeTabAfterCancel = await modalText(); await shot('pay-6-finance-tab-cancel', false); }
  return r;
};
