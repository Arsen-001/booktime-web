const BK = 'bk_01M3TCACCYT4E8G7B9E3YJ7F9H';
export default async ({ go, shot, page, api }) => {
  const r = {};
  await go(`/biz/journal?date=2026-10-03&booking=${BK}`, 4000);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByRole('button', { name: /^Отменил мастер/ }).click();
  await page.waitForTimeout(1500);
  await page.locator('[role=dialog],[role=alertdialog]').last().getByRole('button', { name: 'Отменить и вернуть' }).click();
  await page.waitForTimeout(3000);
  await shot('p3-after-confirm', false);
  r.btns = (await page.locator('[role=dialog]').last().locator('button').allInnerTexts()).filter(Boolean).slice(-6);
  r.b1 = (await api('GET', `/v1/biz/biz_nuri/bookings/${BK}`)).data.status;
  const save = page.locator('[role=dialog]').last().getByRole('button', { name: /Сохранить/ });
  r.save = await save.count();
  if (r.save) { await save.last().click(); await page.waitForTimeout(1500); const yes = page.getByRole("button", { name: "Да", exact: true }); if (await yes.count()) await yes.click(); await page.waitForTimeout(4000); }
  await go("/biz/journal", 4000); await shot("p3-attention", false); r.att = (await page.locator("aside, [data-attention]").allInnerTexts()).join(" | ").slice(0, 600);
  await shot('p3-after-save', false);
  const b = (await api('GET', `/v1/biz/biz_nuri/bookings/${BK}`)).data;
  r.after = { status: b.status, prepayment: b.prepayment };
  return r;
};
