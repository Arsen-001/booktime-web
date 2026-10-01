const page = state.m;
await L.go(page, `/biz/services/${state.svcId}`); await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Удалить' }).first().click(); await page.waitForTimeout(800);
const d = page.locator('[role=alertdialog],[role=dialog]').last();
log('confirm:', (await d.innerText()).slice(0, 300));
await L.shot(page, 'services', 'del01-confirm');
await d.getByRole('button', { name: /Удалить/ }).last().click();
await page.waitForTimeout(1200);
const toast = page.locator('[data-sonner-toast]').filter({ hasText: /удален|удалён/i });
log('toast:', await page.locator('[data-sonner-toast]').allInnerTexts(), page.url());
await L.shot(page, 'services', 'del02-after');
const has = async () => (await page.innerText('main')).includes('QA Маникюр 0930');
await page.waitForTimeout(800);
log('catalog after delete has QA:', await has());
const undo = page.getByRole('button', { name: 'Отменить' });
if (await undo.count()) { await undo.first().click(); await page.waitForTimeout(1500); log('after undo has QA:', await has()); }
else log('no undo button visible');
