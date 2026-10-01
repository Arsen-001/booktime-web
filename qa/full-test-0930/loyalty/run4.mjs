// 01.10: продажа абонемента из /biz/loyalty/memberships с выбором «Чем оплатили» → операция в finance
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import { makeT } from '/Users/arsen/WebstormProjects/booking-platform/qa/e2e/lib.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/loyalty';
const release = await acquireBrowserSlot({ timeoutMs: 4 * 3600_000 });
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ locale: 'ru-RU', timezoneId: 'Asia/Yerevan' })).newPage();
  const t = makeT(page, 'loy', {});
  await t.go('owner', '/biz/loyalty/memberships', 'phone');
  await page.getByRole('button', { name: 'Продать абонемент' }).first().click();
  await t.settle(1500);
  const dlg = page.locator('[role="dialog"]').last();
  await t.pick(dlg.getByRole('combobox').first(), /Маникюр × 5/);
  await dlg.locator('input').first().fill('+37477560936');
  await dlg.getByRole('button', { name: 'Найти' }).click();
  await t.settle(1000);
  await dlg.getByRole('button', { name: 'Сгенерировать' }).click();
  await t.settle(500);
  await page.screenshot({ path: `${OUT}/R8-sell-membership-phone.png` });
  const txt = (await dlg.innerText()).replace(/\n+/g, ' · ');
  console.log('форма:', txt.slice(0, 700));
  await dlg.getByRole('button', { name: /Сохранить и оплатить/ }).click();
  await t.settle(2000);
  console.log('тосты:', (await t.toasts()).join(' / '));
  const fin = await page.evaluate(() => JSON.parse(localStorage.getItem('bp-mock-db:area:finance') ?? '{}'));
  const loy = await page.evaluate(() => JSON.parse(localStorage.getItem('bp-mock-db:area:loyalty') ?? '{}'));
  const sold = (loy.memberships ?? []).filter((m) => m.id.startsWith('lm_') && !m.id.startsWith('lm_biz'));
  const op = (fin.operations ?? []).filter((o) => sold.some((m) => m.id === o.refId));
  console.log('продано:', sold.map((m) => [m.id, m.soldPrice]), 'операции:', op.map((o) => [o.amount, o.method, o.partyName, o.accountId]));
  console.log(op.length === 1 ? 'PASS' : 'FAIL');
} finally { await browser.close(); release(); }
