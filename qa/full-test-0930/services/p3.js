const page = state.pl;
await page.getByRole('menuitem', { name: 'Чужая или найденная в интернете фотография' }).click().catch(async()=>{ await page.getByText('Чужая или найденная в интернете фотография').click(); });
await page.waitForTimeout(1200);
log('toast:', await page.locator('[data-sonner-toast],[role=status]').allInnerTexts());
await L.shot(page, 'platform', 'm03-after-reject');
// approve Новая услуга
const row = page.locator('tr', { hasText: 'Новая услуга: Отбеливание зубов' });
await row.getByRole('button', { name: 'Одобрить' }).click();
await page.waitForTimeout(1200);
log('toast2:', await page.locator('[data-sonner-toast],[role=status]').allInnerTexts());
log((await page.innerText('main')).slice(0, 300));
await page.getByRole('tab', { name: /Отклонено/ }).click(); await page.waitForTimeout(800);
log('REJECTED TAB', (await page.innerText('main')).slice(200, 900));
await page.getByRole('tab', { name: /Одобрено/ }).click(); await page.waitForTimeout(800);
log('APPROVED has service:', (await page.innerText('main')).includes('Отбеливание зубов'));
