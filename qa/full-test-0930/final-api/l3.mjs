const BK = 'bk_01M3TBX8Y7J5RG0HMHFNG1EFNW';
export default async ({ go, shot, page }) => {
  const r = { tries: [] };
  for (let i = 0; i < 2; i++) {
    await go(`/biz/journal?date=2026-10-01&booking=${BK}`, 4000);
    await page.locator('[role=dialog]').last().getByRole('button', { name: 'Выдать карту' }).first().click();
    await page.waitForTimeout(1500);
    const d = page.locator('[role=dialog]').last();
    const txt = (await d.innerText()).slice(0, 400);
    const sel = d.locator('select').first();
    const opts = await sel.locator('option').allInnerTexts();
    await sel.selectOption({ index: 1 });
    await d.getByRole('button', { name: 'Выдать карту' }).last().click();
    await page.waitForTimeout(2500);
    await shot(`l3-issue-${i}`, false);
    r.tries.push({ txt: txt.slice(0, 150), opts, toast: (await page.locator('[data-sonner-toast], [role=status], [role=alert]').allInnerTexts()).join(' | ').slice(0, 200), dlgNow: (await page.locator('[role=dialog]').last().innerText()).slice(0, 200) });
  }
  return r;
};
