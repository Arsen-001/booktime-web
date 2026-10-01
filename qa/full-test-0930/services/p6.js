const page = state.pl;
const d = page.locator('[role=dialog]').last();
await d.getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(500);
log('validation:', (await d.innerText()).match(/Название места\*\n[^\n]*\n?[^\n]*/)?.[0]);
await d.locator('#_r_f_').fill('QA Салон 0930');
await d.getByRole('button', { name: 'Завтра' }).click();
await d.getByRole('button', { name: 'WhatsApp' }).click();
await d.locator('#_r_e_').fill('15000');
await d.getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(1500);
log('toast:', await page.locator('[data-sonner-toast]').allInnerTexts());
log((await page.innerText('main')).match(/Все\n\d+\nДумают\n\d+\nПодключены\n\d+\nОтказались\n\d+/)?.[0]);
log('row:', (await page.innerText('main')).match(/QA Салон 0930[^\n]*\n[^\n]*\n[^\n]*/)?.[0]);
await L.shot(page, 'platform', 'v02-after-save');
// bell
await page.getByRole('button', { name: 'Уведомления' }).click(); await page.waitForTimeout(800);
log('bell:', (await page.locator('[role=dialog],[role=menu]').last().innerText().catch(()=> 'none')).slice(0, 600));
await L.shot(page, 'platform', 'v03-bell');
await page.keyboard.press('Escape');
