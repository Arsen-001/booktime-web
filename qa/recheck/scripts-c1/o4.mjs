import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
async function toDetails(page, time) {
  await page.getByText('Маникюр классический', { exact: true }).first().click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продолжить/ }).click(); await page.waitForTimeout(1200);
  await page.getByText('Ани Саргсян').first().click(); await page.waitForTimeout(800);
  if (await page.getByRole('button', { name: 'Понятно' }).count()) await page.getByRole('button', { name: 'Понятно' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продолжить/ }).click(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: time }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Продолжить/ }).click(); await page.waitForTimeout(1200);
}
async function fill(page, name, phone) {
  await page.getByPlaceholder('Введите имя').fill(name);
  await page.locator('input[type=tel]').fill(phone);
  await page.locator('input[type=checkbox]').last().check({ force: true }).catch(async()=>{ await page.getByText('Согласен на обработку').click(); });
}
const { page: A, context } = await open('guest', '/b/nuri-nail-studio/book', { device: 'phone' });
await toDetails(A, '16:00');
log('A buttons on details', (await A.getByRole('button').allInnerTexts()).map(s=>s.trim()).filter(Boolean));
// invalid phone
await fill(A, 'Тест Валидации', '123');
await A.getByRole('button', { name: 'Записаться' }).click(); await A.waitForTimeout(1500);
log('invalid phone ->', await toast(A), (await text(A)).match(/[^\n]*(номер|телефон)[^\n]*/gi)?.slice(0,5));
// Tab B books same slot
const B = await context.newPage(); B.errors = [];
await B.goto('http://localhost:3710/b/nuri-nail-studio/book', { waitUntil: 'domcontentloaded', timeout: 180000 }); await settle(B);
await toDetails(B, '16:00');
await fill(B, 'Вкладка Б', '11223344');
await B.getByRole('button', { name: 'Записаться' }).click(); await B.waitForTimeout(3000);
log('B after ->', await toast(B), (await text(B)).slice(0, 600));
// A tries with existing client phone
await fill(A, 'Милена', '00169700');
await A.getByRole('button', { name: 'Записаться' }).click(); await A.waitForTimeout(3000);
log('A after (same slot) ->', await toast(A), (await text(A)).slice(0, 700));
const d = await db(A);
const at = d.core.bookings.filter(b=>b.staffId==='st_nuri_ani' && b.start==='2026-09-25T16:00' && !b.deletedAt);
log('bookings Ани 16:00:', JSON.stringify(at.map(b=>[b.id,b.status,b.source,b.clientId])));
await shot(A, 'o4-A-after', true);
log('ERR', A.errors.slice(0,3), B.errors.slice(0,3));
await stop();
