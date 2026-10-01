import { start, stop, open, as, reload, text, shot, db, toasts, wizardToDetails } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/online/settings`, { device: 'desktop' });
const S = page.getByRole('switch');
await S.nth(5).click(); await page.waitForTimeout(300); // surname shown (not required)
await page.getByRole('button', { name: 'Сохранить' }).nth(1).click(); await page.waitForTimeout(1200);
await page.getByPlaceholder('Название поля').fill('Номер машины');
await page.getByRole('button', { name: 'Добавить поле' }).click(); await page.waitForTimeout(1500);
await as(page, 'guest', '/b/nuri-nail-studio/book');
await wizardToDetails(page);
const slot = (await text(page)).match(/\d+ [а-я]+, \d\d:\d\d – \d\d:\d\d/)?.[0]; console.log('slot', slot);
await page.getByPlaceholder('Введите имя').fill('Поля'); 
await page.getByLabel(/Фамилия/).first().fill('Тестова');
await page.getByPlaceholder('91 234 567').fill('91234572');
await page.getByRole('button', { name: 'Получить код' }).click(); await page.waitForTimeout(1200);
console.log('after get code', (await text(page)).match(/[^\n]*(код|Код)[^\n]*/g)?.slice(0,4));
const codeInputs = page.locator('main input[inputmode=numeric], main input[autocomplete=one-time-code]');
console.log('code inputs', await codeInputs.count());
const code = (await toasts(page)).join(' ').match(/Демо-код[^:]*: (\d{4})/)?.[1]; console.log('demo code', code); await codeInputs.first().click(); await page.keyboard.type(code || '0000'); await page.waitForTimeout(500); await page.getByRole('button', { name: 'Подтвердить' }).click(); await page.waitForTimeout(1500);
console.log('after code', (await text(page)).match(/[^\n]*(одтвержд|омер)[^\n]*/g)?.slice(0,4), await toasts(page));
console.log('AFTER CODE PAGE', (await text(page)).slice(0,900).replace(/\n/g,' | '), page.url()); await shot(page,'o4-after-code',true); if (await page.getByLabel(/Email/).count()) await page.getByLabel(/Email/).first().fill('polya.test@example.com');
if (await page.locator('main textarea').count()) await page.locator('main textarea').fill('Комментарий из веб-записи c2');
if (await page.getByLabel(/Номер машины/).count()) await page.getByLabel(/Номер машины/).first().fill('AM 123 BC');
await page.getByText('Согласен на обработку', { exact: false }).click().catch(()=>{});
const ids0 = new Set((await db(page)).core.bookings.map(b=>b.id));
if (await page.getByRole('button', { name: /^Записаться/ }).count()) await page.getByRole('button', { name: /^Записаться/ }).last().click(); await page.waitForTimeout(3000);
console.log('RESULT', (await text(page)).slice(0,400).replace(/\n/g,' | '), page.url());
const d = await db(page); const nb = d.core.bookings.filter(b=>!ids0.has(b.id)); console.log('new booking', JSON.stringify(nb.map(b=>({start:b.start,staff:b.staffId,comment:b.comment,src:b.source,st:b.status,client:b.clientId,extra:b.customFields||b.fields}))));
const c = nb[0] && d.core.clients.find(x=>x.id===nb[0].clientId); console.log('client', JSON.stringify(c));
console.log('online bookingMeta', JSON.stringify(nb[0] && d.areas.online.bookingMeta[nb[0].id]));
console.log('clients profile', JSON.stringify(c && d.areas.clients.profiles[c.id]));
await shot(page, 'o4-result');
if (c) { await as(page, 'owner', `/biz/clients/${c.id}`); const t = await text(page); console.log('card email?', t.includes('polya.test@example.com'), 'surname?', t.includes('Тестова')); await shot(page,'o4-client-card'); }
if (c) {
 await as(page, 'owner', `/biz/clients/${c.id}`); const ct = await text(page); console.log('CARD', ct.slice(0,500).replace(/\n/g,' | '));
 await page.getByRole('button', { name: 'Изменить' }).first().click().catch(()=>{}); await page.waitForTimeout(800); const vals = await page.locator('[role=dialog] input').evaluateAll(els=>els.map(e=>e.value).filter(Boolean)); console.log('edit form values', vals);
 await as(page, 'owner', `/biz/journal?date=2026-09-25`);
 const blk = page.locator('[data-testid="booking-block"]').filter({ hasText: 'Поля' }); console.log('blocks Поля', await blk.count(), await page.locator('[data-testid="booking-block"]').filter({ hasText: '13:00' }).allInnerTexts());
 const target = (await blk.count()) ? blk.first() : page.locator('[data-testid="booking-block"]').filter({ hasText: '13:00–13:45' }).first();
 await target.click(); await page.waitForTimeout(1500); const w = await page.locator('[role=dialog]').last().innerText().catch(()=>'');
 console.log('WINDOW', w.replace(/\n+/g,' | ').slice(0,250)); const allv = (w + ' ' + (await page.locator('[role=dialog]').last().locator('input, textarea').evaluateAll(els=>els.map(e=>e.value).join(' | ')))); console.log('VALUES', allv.slice(-400)); console.log('has custom value', allv.includes('AM 123 BC'), 'has email', allv.includes('polya.test'), 'has surname', allv.includes('Тестова'), 'has comment', allv.includes('Комментарий из веб-записи'));
 const tabC = page.locator('[role=dialog]').last().getByRole('tab', { name: 'Клиент' }); if (await tabC.count()) { await tabC.click(); await page.waitForTimeout(800); const v2 = await page.locator('[role=dialog]').last().locator('input, textarea').evaluateAll(els=>els.map(e=>e.value).join(' | ')); console.log('client tab values', v2); }
 console.log('old', w.includes('AM 123 BC'), 'has email', w.includes('polya.test'), 'has surname', w.includes('Тестова'), 'has comment', w.includes('Комментарий из веб-записи'));
 const tabZ = page.locator('[role=dialog]').last().getByRole('tab', { name: 'Запись' }); if (await tabZ.count()) { await tabZ.click(); await page.waitForTimeout(500);} const ex = page.locator('[role=dialog]').last().getByRole('button', { name: 'Расширенные поля' }); if (await ex.count()) { await ex.click(); await page.waitForTimeout(800); const w2 = (await page.locator('[role=dialog]').last().innerText()) + (await page.locator('[role=dialog]').last().locator('input, textarea').evaluateAll(els=>els.map(e=>e.value).join(' | '))); console.log('expanded has custom', w2.includes('AM 123 BC'), '| label', w2.includes('Номер машины')); }
 await shot(page,'o4-journal-window');
}
await stop();
