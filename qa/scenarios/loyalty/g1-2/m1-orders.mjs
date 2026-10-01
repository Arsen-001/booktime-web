import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();
const p = await b.newPage();
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(String(e)));
await p.goto('http://localhost:3710/biz/loyalty/online-sales/orders?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1500);
const text = await p.locator('body').innerText();
console.log('has Подтвердить:', text.includes('Подтвердить'));
console.log('has Отклонить:', text.includes('Отклонить'));
console.log('has Ждёт оплаты:', text.includes('Ждёт оплаты') || text.includes('ждёт'));
await p.screenshot({ path: 'qa/measure/loyalty/g1-2-shots-m1/online-orders.png', fullPage: true });

const confirmBtn = p.getByRole('button', { name: 'Подтвердить' }).first();
if (await confirmBtn.count()) {
  await confirmBtn.click();
  await p.waitForTimeout(1000);
  const after = await p.locator('body').innerText();
  console.log('after confirm has "Оплачено"/"Подтверждён":', after.includes('Подтверждён') || after.includes('Активен'));
  await p.screenshot({ path: 'qa/measure/loyalty/g1-2-shots-m1/online-orders-after-confirm.png', fullPage: true });
} else {
  console.log('NO confirm button found - checking reject');
  const rejectBtn = p.getByRole('button', { name: 'Отклонить' }).first();
  console.log('reject btn count:', await rejectBtn.count());
}
console.log('page errors:', pageErrors);
await b.close();
release();
