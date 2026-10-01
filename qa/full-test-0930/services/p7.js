const page = state.pl;
await page.getByRole('button', { name: 'Уведомления' }).click(); await page.waitForTimeout(5000);
log('bell:', (await page.locator('[role=dialog]').last().innerText().catch(()=> 'none')).slice(0, 800));
await L.shot(page, 'platform', 'v04-bell-5s');
await page.keyboard.press('Escape');
