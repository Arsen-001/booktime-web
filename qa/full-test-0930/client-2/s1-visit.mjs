// Визит и оплата в «приложении для бизнеса» (F-14-092, 094–098, 102, 074)
import { start, newPage, go, shot, text } from './h.mjs';

const { browser, done } = await start();
const log = (...a) => console.log(...a);
try {
  const { page, errors } = await newPage(browser, { device: 'phone' });
  await go(page, '/biz/apps/visit', 'owner');
  await shot(page, 'visit-list');
  const t0 = await text(page);
  log('LIST:', t0.slice(0, 600).replace(/\n+/g, ' | '));
  // Открыть первый визит со статусом «Пришёл», иначе первый
  const cards = page.locator('main li');
  const n = await cards.count();
  log('visits:', n);
  let idx = 0;
  for (let i = 0; i < n; i++) if ((await cards.nth(i).innerText()).includes('Пришёл')) { idx = i; break; }
  await cards.nth(idx).click();
  await page.waitForTimeout(1500);
  await shot(page, 'visit-modal');
  const dlg = page.getByRole('dialog');
  log('MODAL:', (await dlg.innerText()).slice(0, 500).replace(/\n+/g, ' | '));

  // Продажа товара
  await dlg.getByLabel('Название').fill('Шампунь QA');
  const price = dlg.getByLabel('Цена');
  await price.fill('3500');
  await dlg.getByRole('button', { name: 'Добавить в визит' }).click();
  await page.waitForTimeout(1500);
  log('after sale has line:', (await dlg.innerText()).includes('Шампунь QA'));
  // Пустая продажа — валидация
  await dlg.getByRole('button', { name: 'Добавить в визит' }).click();
  await page.waitForTimeout(800);
  log('empty sale toast:', (await page.locator('body').innerText()).includes('Укажите название'));
  await shot(page, 'visit-sale');

  // Оплата
  await dlg.getByRole('tab', { name: 'Оплата' }).click();
  await page.waitForTimeout(800);
  const payTxt = await dlg.innerText();
  log('PAY:', payTxt.slice(0, 700).replace(/\n+/g, ' | '));
  await shot(page, 'visit-pay');
  if (!payTxt.includes('Оплата ещё не открыта')) {
    // частичная оплата наличными 1000
    const amt = dlg.getByLabel('Сумма');
    await amt.fill('1000');
    await dlg.getByRole('button', { name: /^Оплатить|Принять оплату/ }).first().click();
    await page.waitForTimeout(1500);
    let tx = await dlg.innerText();
    log('after partial:', tx.slice(0, 700).replace(/\n+/g, ' | '));
    // картой — вся сумма
    await dlg.getByRole('button', { name: 'Карта' }).click().catch((e) => log('no card btn', e.message));
    await page.waitForTimeout(500);
    await dlg.getByRole('button', { name: 'Вся сумма' }).click().catch((e) => log('no full btn', e.message));
    await page.waitForTimeout(300);
    await dlg.getByRole('button', { name: /^Оплатить|Принять оплату/ }).first().click();
    await page.waitForTimeout(1500);
    tx = await dlg.innerText();
    log('after full:', tx.slice(0, 900).replace(/\n+/g, ' | '));
    await shot(page, 'visit-paid');
    // возврат первой оплаты
    const refund = dlg.getByRole('button', { name: 'Возврат' }).first();
    if (await refund.count()) {
      await refund.click();
      await page.waitForTimeout(1500);
      log('after refund:', (await dlg.innerText()).slice(0, 900).replace(/\n+/g, ' | '));
    }
    // Квитанция
    const send = dlg.getByRole('button', { name: 'Отправить клиенту' });
    if (await send.count()) {
      await send.click();
      await page.waitForTimeout(1500);
      log('receipt sent label:', (await dlg.innerText()).includes('Отправлено'));
    }
    await shot(page, 'visit-refund');
  }

  // Лояльность
  await dlg.getByRole('tab', { name: /Лояльность/ }).click();
  await page.waitForTimeout(1000);
  log('LOY:', (await dlg.innerText()).slice(0, 600).replace(/\n+/g, ' | '));
  const issue = dlg.getByRole('button', { name: 'Выдать карту' });
  if (await issue.count()) {
    await issue.click();
    await page.waitForTimeout(1500);
    log('issue toast:', (await page.locator('body').innerText()).match(/Карта .* выдана/)?.[0]);
  }
  const codeInput = dlg.getByPlaceholder('Номер сертификата или карты');
  if (await codeInput.count()) {
    await codeInput.fill('NOPE-000');
    await dlg.getByRole('button', { name: 'Найти' }).click();
    await page.waitForTimeout(1200);
    log('code not found shown:', (await dlg.innerText()).includes('Ничего не нашли'));
  }
  await shot(page, 'visit-loyalty');

  // Пуш
  const w = dlg.getByRole('button', { name: 'Написать клиенту' });
  if (await w.count()) {
    await w.click();
    await page.waitForTimeout(500);
    const ta = dlg.getByPlaceholder('Текст сообщения…');
    if (await ta.count()) {
      await ta.fill('QA push привет');
      await dlg.getByRole('button', { name: 'Отправить', exact: true }).click();
      await page.waitForTimeout(1500);
      log('push toast:', (await page.locator('body').innerText()).includes('Отправлено в приложение клиента'));
    } else log('push composer disabled:', (await dlg.innerText()).includes('нет приложения'));
  }
  await shot(page, 'visit-push');
  await page.keyboard.press('Escape');

  // Клиент видит пуш? (та же вкладка, персона client)
  await go(page, '/notifications', 'client');
  const nt = await text(page);
  log('client notifications has QA push:', nt.includes('QA push'));
  log('NOTIF:', nt.slice(0, 500).replace(/\n+/g, ' | '));
  await shot(page, 'visit-client-notifs');

  // Журнал владельца: продажа видна?
  log('ERRORS:', errors.slice(0, 8));
} catch (e) {
  console.error('FAIL', e);
} finally {
  await done();
}
