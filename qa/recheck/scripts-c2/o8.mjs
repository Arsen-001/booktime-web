import { start, stop, open, as, reload, text, shot, db, toasts, wizardToDetails } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online/widget', { device: 'desktop', sphere: 'nails' });
await page.getByPlaceholder('beauty-spa').fill('nuri-c2'); await page.getByRole('button', { name: 'Сохранить' }).last().click(); await page.waitForTimeout(1500); console.log('nuri save', await toasts(page));
await as(page, 'owner', '/biz/online/widget', '&sphere=barber');
const bizName = (await text(page)).match(/Для «([^»]+)»/)?.[1]; console.log('now business', bizName);
await page.getByPlaceholder('beauty-spa').fill('nuri-c2'); await page.getByRole('button', { name: 'Сохранить' }).last().click(); await page.waitForTimeout(1500);
console.log('barber save same subdomain', await toasts(page), '| error', (await text(page)).match(/[^\n]*(занят|уже)[^\n]*/)?.[0]);
const d = await db(page); console.log('subdomains', JSON.stringify(d.areas.online.links.filter(l=>l.subdomain).map(l=>[l.businessId,l.subdomain])));
// F-03-100 cancel then book again
await as(page, 'guest', '/b/nuri-nail-studio/book', '&sphere=nails');
await wizardToDetails(page);
await page.getByPlaceholder('Введите имя').fill('Отмена Тест'); await page.getByPlaceholder('91 234 567').fill('91234573');
await page.getByRole('button', { name: 'Получить код' }).click(); await page.waitForTimeout(1200);
const code = (await toasts(page)).join(' ').match(/: (\d{4})/)?.[1]; await page.locator('main input[inputmode=numeric]').first().click(); await page.keyboard.type(code||'0000'); await page.getByRole('button', { name: 'Подтвердить' }).click(); await page.waitForTimeout(1200);
await page.getByText('Согласен на обработку', { exact: false }).click().catch(()=>{});
await page.getByRole('button', { name: /^Записаться/ }).last().click(); await page.waitForTimeout(3000);
console.log('booked', page.url());
await page.getByRole('button', { name: 'Отменить' }).first().click(); await page.waitForTimeout(800);
const cd = page.locator('[role=alertdialog],[role=dialog]').last(); console.log('CONFIRM', (await cd.innerText()).replace(/\n+/g,' | ').slice(0,200));
await cd.getByRole('button', { name: /Отменить запись|Да/ }).last().click(); await page.waitForTimeout(2000);
const t = await text(page); console.log('AFTER CANCEL', t.slice(0,300).replace(/\n/g,' | '));
const again = page.getByRole('link', { name: /Записаться ещё/ }).or(page.getByRole('button', { name: /Записаться ещё/ })); console.log('again btn', await again.count());
if (await again.count()) { await again.first().click(); await page.waitForTimeout(2000); console.log('again url', page.url()); }
await stop();
