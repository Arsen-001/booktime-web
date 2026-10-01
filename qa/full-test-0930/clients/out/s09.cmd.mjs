import { rowHrefs } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients/steps/rowhref.mjs';
// Объединение дублей: две карточки из импорта s08 → одна; удаление карточки; журнал
import fs from 'node:fs';
export default async ({ page, go, shot, text }) => {
  const r = {};
  const s08 = JSON.parse(fs.readFileSync('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients/out/s08.cmd.mjs'.replace('.cmd.mjs', '.json'), 'utf8'));
  const st = (s08.value?.found?.[0]?.match(/(\d{6})/) || [])[1];
  r.st = st;
  await go(`/biz/clients?q=${st}`);
  const hrefs = await rowHrefs(page, 4);
  r.before = hrefs.length;
  if (hrefs.length < 2) return r;
  await go(hrefs[0]);
  await page.getByRole('button', { name: /^Ещё$|Действия с клиентом/ }).first().click(); await page.waitForTimeout(600);
  r.menu = await page.getByRole('menuitem').allInnerTexts();
  await page.getByRole('menuitem', { name: /Объединить/ }).click(); await page.waitForTimeout(800);
  const dlg = page.locator('[role=dialog]').last();
  r.mergeDlg = (await dlg.innerText()).slice(0, 600);
  await shot('s09-merge');
  await dlg.getByRole('combobox').first().click();
  await page.keyboard.type(`Второй ${st}`); await page.waitForTimeout(800);
  await page.getByRole('option').first().click(); await page.waitForTimeout(400);
  await dlg.getByRole('button', { name: /Продолжить/ }).click(); await page.waitForTimeout(700);
  const conf = page.locator('[role=alertdialog]').last();
  r.confirm = (await conf.innerText().catch(() => '')).slice(0, 400);
  await conf.getByRole('button', { name: /Объединить/ }).click(); await page.waitForTimeout(2000);
  r.afterUrl = page.url();
  await go(`/biz/clients?q=${st}`);
  r.after = (await page.locator('table tbody tr').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').slice(0, 80));
  // удаление оставшейся карточки
  const left = (await rowHrefs(page, 1))[0] ?? null;
  if (left) {
    await go(left);
    await page.getByRole('button', { name: /^Ещё$|Действия с клиентом/ }).first().click(); await page.waitForTimeout(500);
    await page.getByRole('menuitem', { name: /^Удалить$/ }).click(); await page.waitForTimeout(700);
    const c2 = page.locator('[role=alertdialog]').last();
    r.delConfirm = (await c2.innerText().catch(() => '')).slice(0, 300);
    await c2.getByRole('button', { name: /Удалить/ }).last().click(); await page.waitForTimeout(2000);
    r.afterDelUrl = page.url();
    await go(left);
    r.deletedCard = (await text()).slice(0, 300);
    await go(`/biz/clients?q=${st}`);
    r.afterDel = await page.locator('table tbody tr').count();
    r.afterDelText = (await text()).slice(0, 300);
  }
  await go('/biz/clients/log');
  r.log = (await text()).slice(0, 800);
  return r;
};
