const page = state.pl;
const t0 = await page.innerText('main');
log('before:', t0.slice(t0.indexOf('Первый в районе'), t0.indexOf('Первый в районе') + 260));
await page.getByRole('button', { name: 'Наградить' }).nth(1).click();
for (let i = 0; i < 6; i++) { await page.waitForTimeout(1000); const ts = await page.locator('[data-sonner-toast]').allInnerTexts(); if (ts.length) { log('toast', ts); break; } }
const t = await page.innerText('main');
log('after:', t.slice(t.indexOf('Первый в районе'), t.indexOf('Первый в районе') + 260));
