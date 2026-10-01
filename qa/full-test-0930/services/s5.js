const page = state.owner;
const dlg = page.locator('[role=dialog]').last();
await dlg.getByText('Маникюр', { exact: true }).last().click(); await page.waitForTimeout(800);
const t = await page.locator('[role=dialog]').last().innerText();
const i = t.indexOf('QA Маникюр 0930', t.indexOf('Все услуги'));
log('in list:', i >= 0, t.slice(t.indexOf('Все услуги'), t.indexOf('Все услуги') + 700));
await L.shot(page, 'services', 's05-journal-allservices');
