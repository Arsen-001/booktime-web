const page = state.owner;
await page.getByRole('button', { name: 'Сохранить' }).click();
await page.waitForTimeout(2000);
log('toast:', await page.locator('[data-sonner-toast],[role=status]').allInnerTexts());
log('url', page.url());
const svc = await page.evaluate(() => { for (const k of Object.keys(localStorage)) { const v = localStorage.getItem(k); if (v && v.includes('QA Маникюр 0930')) { const m = v.indexOf('QA Маникюр 0930'); return k + ' :: ' + v.slice(m - 400, m + 600); } } return 'not found'; });
log(svc);
