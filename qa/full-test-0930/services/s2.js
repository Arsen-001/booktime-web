const page = state.owner;
await page.getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(600);
log('validation:', (await page.locator('[role=alert], .text-danger, [id$=-error]').allInnerTexts()).join(' | '));
await L.shot(page, 'services', 's02-validation');
await page.getByLabel('Название · Русский').fill('QA Маникюр 0930');
await page.locator('#svc-f-category').click(); await page.getByRole('option', { name: 'Маникюр' }).click();
await page.locator('#svc-f-duration').click(); await page.getByRole('option', { name: '1 ч', exact: true }).click();
await page.getByRole('combobox', { name: 'Минуты' }).click(); await page.getByRole('option', { name: '30 мин' }).click();
// цена от–до
const priceToggle = page.getByText('Цена «от–до»'); await priceToggle.click(); await page.waitForTimeout(300);
await page.locator('#svc-f-price input, input#svc-f-price').first().fill('8000');
const max = page.locator('#svc-f-price-max input, input#svc-f-price-max').first();
log('max count', await max.count());
if (await max.count()) await max.fill('12000');
// мастер Ани
const ani = page.locator('label, tr, li, div').filter({ hasText: /^Ани Саргсян/ }).locator('input[type=checkbox]').first();
await page.getByText('Ани Саргсян', { exact: true }).click();
await page.waitForTimeout(300);
await page.getByLabel(/Напомнить клиенту через/).fill('21').catch(e=>log('reminder fail', e.message.slice(0,100)));
await L.shot(page, 'services', 's03-filled');
log((await page.innerText('main')).match(/Цена[\s\S]{0,200}/)?.[0]);
log((await page.innerText('main')).match(/Ани Саргсян[\s\S]{0,60}/)?.[0]);
