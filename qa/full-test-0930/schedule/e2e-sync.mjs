// Сценарий: правка графика Ани на 08.10 → журнал и онлайн-запись видят новые часы; удаление дня → окон нет; «Отменить» → вернулось
import { withBrowser, ctx, go, shot } from './lib.mjs';
const STAFF = 'st_nuri_ani', D = '2026-10-08', SVC = 'sv_nuri_remove';
const log = (...a) => console.log(...a);
async function slots(page, tag) {
  await go(page, `/b/nuri-nail-studio/book?step=time&s=${SVC}&m=${STAFF}&d=${D}`);
  await page.waitForTimeout(1500);
  await shot(page, `sync-${tag}-online`);
  const times = await page.$$eval('button', (bs) => bs.map((b) => b.innerText.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s)));
  log(`[online ${tag}]`, times.length, times.slice(0, 4).join(','), '…', times.slice(-3).join(','));
  return times;
}
async function journal(page, tag) {
  await go(page, `/biz/journal?date=${D}`);
  await page.waitForTimeout(1500);
  await shot(page, `sync-${tag}-journal`);
  await page.getByText('17:00', { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, `sync-${tag}-journal-late`);
  log(`[journal ${tag} hint]`, (await page.getByText(/свободно \d/).allInnerTexts()).join(' | ').slice(0, 200));
  const txt = await page.innerText('main').catch(() => '');
  const i = txt.indexOf('Ани');
  log(`[journal ${tag}]`, JSON.stringify(txt.slice(Math.max(0, i - 50), i + 120)));
}
async function scheduleWeek(page) {
  await go(page, '/biz/schedule');
  for (let k = 0; k < 4 && !(await page.$(`[data-cell="${STAFF}|${D}"]:visible`)); k++) {
    await page.getByRole('button', { name: 'Следующий период' }).first().click();
    await page.waitForTimeout(1000);
  }
  const cell = page.locator(`[data-cell="${STAFF}|${D}"]:visible`);
  log('[cell]', await cell.innerText());
  return cell;
}
export async function run(b) {
  const { page, errors } = await ctx(b);
  const before = await slots(page, '0-before');
  await journal(page, '0-before');
  // 1. Вечер 15–21
  let cell = await scheduleWeek(page);
  await shot(page, 'sync-1-table');
  await cell.click();
  await page.getByRole('button', { name: /Настроить \(1\)/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Вечер 15–21/ }).click();
  await shot(page, 'sync-1-panel');
  await page.getByRole('button', { name: /^Сохранить/ }).last().click();
  await page.waitForTimeout(1500);
  const keep = page.getByRole('button', { name: /записи оставить|Сохранить всё равно/ });
  if (await keep.count()) { log('[affected]', (await page.locator('[role=dialog]').last().innerText()).slice(0, 400)); await shot(page, 'sync-1-affected'); await keep.first().click(); await page.waitForTimeout(1500); }
  await shot(page, 'sync-1-saved');
  log('[toast]', (await page.locator('[role=status],[data-sonner-toast],[role=alert]').allInnerTexts()).join(' | '));
  log('[cell after]', await page.locator(`[data-cell="${STAFF}|${D}"]:visible`).innerText());
  const evening = await slots(page, '1-evening');
  await journal(page, '1-evening');
  // 2. Удалить день
  cell = await scheduleWeek(page);
  await cell.click();
  await page.getByRole('button', { name: /^Удалить$/ }).click();
  await page.waitForTimeout(1200);
  const dlg = page.getByRole('button', { name: 'Всё равно удалить' });
  if (await dlg.count()) { log('[confirm] есть записи → Всё равно удалить'); await dlg.click(); await page.waitForTimeout(1000); }
  await shot(page, 'sync-2-deleted');
  log('[cell deleted]', await page.locator(`[data-cell="${STAFF}|${D}"]:visible`).innerText());
  const undoBtn = page.getByRole('button', { name: 'Отменить' });
  log('[undo visible]', await undoBtn.count());
  if (await undoBtn.count()) { await undoBtn.first().click(); await page.waitForTimeout(1200); log('[cell after undo]', await page.locator(`[data-cell="${STAFF}|${D}"]:visible`).innerText()); }
  await page.locator(`[data-cell="${STAFF}|${D}"]:visible`).click();
  await page.getByRole('button', { name: /^Удалить$/ }).click();
  await page.waitForTimeout(1200);
  if (await dlg.count()) { await dlg.click(); await page.waitForTimeout(1000); }
  log('[cell deleted2]', await page.locator(`[data-cell="${STAFF}|${D}"]:visible`).innerText());
  await page.waitForTimeout(6000);
  const off = await slots(page, '2-off');
  await journal(page, '2-off');
  log('[errors]', errors.slice(0, 10));
  log(JSON.stringify({ before: before.length, evening: evening.length, eveningFirst: evening[0], off: off.length }));
}
