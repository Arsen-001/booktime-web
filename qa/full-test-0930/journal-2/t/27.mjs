const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const p = state.owner; let o='';
  await p.getByText('Номер телефона', { exact: true }).click();
  const wl = p.getByLabel('Показывать лист ожидания').first(); o += 'wl checked before ' + await wl.isChecked() + '\n';
  await wl.click();
  await p.getByRole('button', { name: 'Сохранить', exact: true }).first().click(); await p.waitForTimeout(1500);
  o += 'TOAST ' + await toasts(p) + '\n';
  await go(p, '/biz/journal'); await waitReady(p);
  const first = await p.locator('[data-testid=booking-block]').first().innerText(); o += 'CARD1 ' + first.replace(/\n/g,' / ') + '\n';
  await lib.shot(p, 'o27-firstline-phone');
  await p.getByRole('button', { name: 'Ещё', exact: true }).first().click(); await p.waitForTimeout(800);
  o += 'WL tile present: ' + (await p.locator('[role=dialog]').last().getByText('Лист ожидания', { exact: true }).count()) + '\n';
  await p.keyboard.press('Escape');
  // revert
  await go(p, '/biz/journal/settings'); await waitReady(p);
  await p.getByText('Название услуги', { exact: true }).click();
  await p.getByLabel('Показывать лист ожидания').first().click();
  await p.getByRole('button', { name: 'Сохранить', exact: true }).first().click(); await p.waitForTimeout(1500);
  await go(p, '/biz/journal'); await waitReady(p);
  o += 'CARD1 after revert ' + (await p.locator('[data-testid=booking-block]').first().innerText()).replace(/\n/g,' / ') + '\n';
  return o;
};
