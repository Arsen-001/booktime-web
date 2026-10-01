const page = state.pl;
const row = page.locator('tr', { hasText: 'Фото мастера · Ани Саргсян' });
await row.getByRole('button', { name: 'Отклонить — выбрать причину' }).click();
await page.waitForTimeout(800);
log((await page.locator('[role=dialog],[role=menu]').first().innerText()).slice(0, 800));
await L.shot(page, 'platform', 'm02-reject-menu');
