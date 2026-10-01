const page = state.pl;
await L.go(page, '/platform/visits'); await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Новый визит' }).click(); await page.waitForTimeout(800);
const d = page.locator('[role=dialog]').last();
log((await d.innerText()).slice(0, 1500));
log((await d.evaluate((el) => [...el.querySelectorAll('input,textarea,button,[role=combobox]')].map((e) => `${e.tagName}#${e.id}[${e.getAttribute('role')||e.type}] ${e.getAttribute('aria-label')||e.innerText||e.placeholder||''}`.slice(0,90)))).join('\n'));
await L.shot(page, 'platform', 'v01-new-visit');
