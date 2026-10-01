export default async ({ go, shot, text, page, api }) => {
  await go('/biz/journal?new=1&staff=st_nuri_ani&start=19%3A00&date=2026-10-01', 4000);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByPlaceholder('91 234 567').fill('99000991');
  await page.waitForTimeout(1500);
  await dlg.getByPlaceholder('Имя').fill('QA Финал');
  await dlg.getByRole('button', { name: /Маникюр классический/ }).first().click();
  await page.waitForTimeout(1000);
  await shot('s2-filled', false);
  const btns = await dlg.locator('button').allInnerTexts();
  const save = dlg.getByRole('button', { name: /^(Записать|Сохранить|Создать)/ }).last();
  const saveText = await save.innerText();
  const reqs = []; page.on("request", (r) => { if (r.url().includes(":4010")) reqs.push(r.method() + " " + r.url().slice(21, 140)); }); page.on("requestfailed", (r) => reqs.push("FAILED " + r.url().slice(21, 120) + " " + r.failure()?.errorText));
  await save.click();
  await page.waitForTimeout(1500);
  const yes = page.getByRole("button", { name: "Да", exact: true });
  if (await yes.count()) { await yes.click(); }
  await page.waitForTimeout(15000);
  await shot("s2-after", false);
  const list = await api('GET', '/v1/biz/biz_nuri/bookings?from=2026-10-01&to=2026-10-02');
  const mine = (list.data||[]).filter((b) => b.start?.includes("T19:00") && b.staffId === "st_nuri_ani");
  return { reqs, dialogs: await page.locator("[role=dialog],[role=alertdialog]").allInnerTexts().then((a)=>a.map((x)=>x.slice(0,150))), mine: JSON.stringify(mine).slice(0, 900), saveText, btnsTail: btns.slice(-5), url: page.url(), list: JSON.stringify(list).slice(0, 300) };
};
