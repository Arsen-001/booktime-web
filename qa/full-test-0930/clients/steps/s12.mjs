// Действие: интервал повтора услуги 21 → 7 дней — подборка «Пора записать» растёт; обратно 21 — возвращается
export default async ({ page, go, shot, text }) => {
  const r = {};
  const dueCount = async () => {
    await go('/biz/clients');
    const s = await page.getByRole('button', { name: /Пора записать/ }).first().innerText();
    return Number((s.match(/\d+/) || [])[0]);
  };
  r.before = await dueCount();
  const setRepeat = async (v) => {
    await go('/biz/services/sv_nuri_classic');
    r.svcHead = (await text()).slice(0, 200);
    const f = page.getByLabel(/Напомнить клиенту через/).first();
    r.hasField = await f.count();
    if (!r.hasField) return;
    await f.scrollIntoViewIfNeeded();
    r[`old${v}`] = await f.inputValue();
    await f.fill(String(v));
    await page.getByRole('button', { name: /^Сохранить/ }).last().click(); await page.waitForTimeout(2000);
  };
  await setRepeat(7);
  r.after7 = await dueCount();
  await shot('s12-due-after7');
  await setRepeat(21);
  r.after21 = await dueCount();
  return r;
};
