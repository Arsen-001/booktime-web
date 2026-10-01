// Импорт вставкой (2 новых + 1 с ошибкой) → в базе; повторная загрузка; выгрузка CSV; права админа/мастера на импорт
export default async ({ page, go, shot, text }) => {
  const r = {};
  const st = String(Date.now()).slice(-6);
  await go('/biz/clients/import');
  r.head = (await text()).slice(0, 900);
  await shot('s08-import');
  const ta = page.getByPlaceholder(/Вставьте сюда данные/).first();
  const data = `Имя\tТелефон\tEmail\nИмпорт Первый ${st}\t37455${st}\ta${st}@x.am\nИмпорт Второй ${st}\t37466${st}\t\nБезНомера ${st}\t\t\n`;
  await ta.fill(data);
  await page.getByRole('button', { name: /Загрузить из поля/ }).click(); await page.waitForTimeout(1500);
  r.map = (await text()).slice(0, 1500);
  await shot('s08-map');
  const load = page.getByRole('button', { name: /^Загрузить(\s|$)/ }).last();
  r.loadBtns = await page.getByRole('button').allInnerTexts();
  await load.click().catch((e) => { r.loadErr = String(e).slice(0, 200); });
  await page.waitForTimeout(2500);
  r.result = (await text()).slice(0, 1500);
  await shot('s08-result');
  await go(`/biz/clients?q=${st}`);
  r.found = (await page.locator('table tbody tr').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').slice(0, 80));
  // выгрузка
  await go('/biz/clients/import');
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    page.getByRole('button', { name: /Выгрузить|Скачать/ }).first().click().catch((e) => { r.exportErr = String(e).slice(0, 200); }),
  ]);
  if (dl) {
    const p = `/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/clients/export-${st}.csv`;
    await dl.saveAs(p);
    const csv = fs.readFileSync(p, 'utf8');
    r.csvHead = csv.slice(0, 300); r.csvLines = csv.split('\n').length; r.csvHasImported = csv.includes(`Импорт Первый ${st}`);
  }
  await page.waitForTimeout(1000);
  r.afterExport = (await text()).slice(0, 1500);
  for (const persona of ['admin', 'master']) {
    await go('/biz/clients/import', { persona });
    r[persona] = (await text()).slice(0, 300);
  }
  return r;
};
import fs from 'node:fs';
