import { start, stop, open, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/notifications/mailings/new`, { device: 'desktop' });
const cnt = async () => (await text(page)).match(/Получат сообщение: (\d+)/)?.[1];
for (let i=1;i<=4;i++){
  await as(page, 'owner', '/biz/notifications/mailings/new');
  const send = page.getByRole('button', { name: 'Отправить' });
  await page.locator('textarea').fill(`Проверка лимита ${i}`); await page.waitForTimeout(300);
  console.log(i, 'send enabled', await send.isEnabled(), '| limit text', (await text(page)).match(/[^\n]*из 3[^\n]*/)?.[0]);
  if (await send.isEnabled()) { await send.click(); await page.waitForTimeout(1500); console.log('  toasts', await toasts(page)); }
}
let d = await db(page); console.log('mailings', JSON.stringify(Object.values(d.areas.notify.mailings).flat().map(m=>[m.channel,m.recipients ?? m.recipientCount, m.text?.slice(0,20)]).slice(-5)));
// connect SMS
await as(page, 'owner', '/biz/notifications/channels/sms');
await page.locator('input[placeholder="AGG-XXXX-XXXX"]').fill('AGG-TEST-1234'); await page.getByRole('button', { name: 'Подключить' }).click(); await page.waitForTimeout(1500);
await as(page, 'owner', '/biz/notifications/mailings/new');
const radios = page.locator('main input[type=radio]'); console.log('radio disabled', await radios.evaluateAll(els=>els.map(e=>e.disabled)));
await radios.nth(2).check({ force: true }); await page.waitForTimeout(600);
const boxes = page.locator('main input[type=checkbox]');
console.log('sms, only-app state', await boxes.nth(0).isChecked(), 'count', await cnt());
if (await boxes.nth(0).isChecked()) { await boxes.nth(0).click({ force: true }); await page.waitForTimeout(600); }
console.log('sms all count', await cnt());
await boxes.nth(1).click({ force: true }); await page.waitForTimeout(600); console.log('birthday count', await cnt());
await boxes.nth(1).click({ force: true }); await page.waitForTimeout(400);
await pick(page, page.getByRole('combobox').first(), 'Получал(и)'); await page.waitForTimeout(600); console.log('received count', await cnt());
await pick(page, page.getByRole('combobox').first(), 'Не получал(и)'); await page.waitForTimeout(600); console.log('not received count', await cnt());
d = await db(page); const cls = d.core.clients.filter(c=>c.businessId==='biz_nuri');
const m = new Date().getMonth()+1; console.log('DB birthday this month', cls.filter(c=>c.birthday && +c.birthday.slice(5,7)===m).length, 'bday non-blacklisted', cls.filter(c=>c.birthday && +c.birthday.slice(5,7)===m && !(c.blacklisted)).length);
// SMS gate
await page.locator('textarea').fill('SMS проверка'); await page.waitForTimeout(300);
const send = page.getByRole('button', { name: 'Отправить' }); console.log('sms send enabled w/o legal', await send.isEnabled(), '| text', (await text(page)).match(/[^\n]*ответственност[^\n]*/)?.[0]);
await shot(page, 'n3-sms-form');
await stop();
