// Сценарий E: перепроверка починок + добор (удаление пользователя, push, выгрузка, карточка клиента, аналитика, записи)
import { connect, newPage, go, shot, text, toasts } from './h.mjs';
const browser = await connect();
const say = (...a) => console.log(...a);
const flat = (s, n = 500) => s.replace(/\n+/g, ' | ').slice(0, n);
const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
const main = page.locator('main');
const dlg = () => page.getByRole('dialog').last();
const lastToast = async () => (await toasts(page)).slice(-1)[0];
async function step(name, fn) { try { await fn(); } catch (e) { say('STEP FAIL', name, e.message.split('\n')[0].slice(0, 200)); await shot(page, 'e-fail-' + name).catch(() => {}); } }

if (0) await step('api-error-settings', async () => {
  await page.goto('http://localhost:3710/biz/network/settings?demo=network&lang=ru&api=error', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  say('api=error settings:', flat(await text(page), 150));
  await shot(page, 'e01-settings-api-error');
});
await step('route-validation', async () => {
  await go(page, '/biz/network/telephony');
  const c = main.getByRole('button', { name: 'Подключить телефонию' });
  if (await c.count()) { await c.click(); await page.waitForTimeout(1200); }
  await main.getByRole('button', { name: 'Добавить маршрут' }).click();
  await page.waitForTimeout(600);
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(400);
  say('route empty errors:', (await dlg().innerText()).match(/Введите название маршрута|Отметьте хотя бы один филиал/g));
  await shot(page, 'e02-route-errors');
  await dlg().getByLabel('Название маршрута').fill('QA маршрут');
  await dlg().getByRole('button', { name: 'Выбрать все' }).click();
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  say('route toast', await lastToast(), 'listed', (await text(page)).includes('QA маршрут'));
  await main.getByRole('button', { name: 'Добавить правило' }).click();
  await page.waitForTimeout(500);
  await dlg().getByLabel('Номер или SIP-идентификатор').fill('abc');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(300);
  say('rule bad:', ((await dlg().innerText()).match(/Только цифры/) ?? [])[0]);
  await page.keyboard.press('Escape');
  await shot(page, 'e03-telephony', true);
});
await step('field-validation', async () => {
  await go(page, '/biz/network/settings/fields');
  await main.getByRole('button', { name: 'Добавить поле' }).first().click();
  await page.waitForTimeout(600);
  await dlg().getByLabel('Название').fill('QA Аллергия');
  await dlg().getByLabel('Ключ API').fill('qa_allergy');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(500);
  say('field no-branch error:', ((await dlg().innerText()).match(/Отметьте хотя бы один филиал/) ?? [])[0]);
  await shot(page, 'e04-field-branch-error');
  await dlg().getByRole('checkbox', { name: /Нор-Норк/ }).click();
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  say('field toast', await lastToast(), 'listed', (await text(page)).includes('QA Аллергия'));
  // удалить со словом
  await main.getByRole('button', { name: /Удалить/ }).first().click().catch(() => say('no delete btn'));
  await page.waitForTimeout(500);
  if (await page.getByRole('dialog').count()) {
    say('delete dlg:', flat(await dlg().innerText(), 250));
    await dlg().locator('input').last().fill('удалить');
    await dlg().getByRole('button', { name: /Удалить/ }).last().click();
    await page.waitForTimeout(1000);
    say('delete toast', await lastToast(), 'still', (await text(page)).includes('QA Аллергия'));
  }
});
await step('user-remove-perms', async () => {
  await go(page, '/biz/network/settings/users');
  await main.getByRole('button', { name: 'Создать пользователя' }).click();
  await page.waitForTimeout(400);
  await dlg().getByLabel('Имя').fill('QA Юзер2');
  await dlg().getByLabel('Логин').fill('qa2');
  await dlg().getByLabel('Пароль').fill('secret123');
  await dlg().getByRole('button', { name: 'Создать пользователя' }).click();
  await page.waitForTimeout(1200);
  await main.getByText('QA Юзер2').first().click();
  await page.waitForTimeout(600);
  await dlg().getByRole('tab', { name: 'Права' }).click();
  await page.waitForTimeout(300);
  await dlg().getByRole('button', { name: 'Снять все' }).first().click();
  await shot(page, 'e05-perms-footer');
  await page.getByRole('dialog').last().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1000);
  say('perm toast', await lastToast());
  await dlg().getByRole('tab', { name: 'Информация' }).click();
  await dlg().getByRole('button', { name: 'Убрать из сети' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'e06-remove-confirm');
  await page.getByRole('alertdialog').getByRole('button', { name: /Убрать/ }).click().catch(async () => page.getByRole('button', { name: /^Убрать$/ }).last().click());
  await page.waitForTimeout(1200);
  say('remove toast', await lastToast(), 'still listed', (await text(page)).includes('QA Юзер2'));
});
await step('clients', async () => {
  await go(page, '/biz/network/clients');
  const rows = main.locator('tbody tr');
  await rows.nth(0).getByRole('checkbox').click();
  await main.getByRole('button', { name: 'Рассылка' }).click();
  await page.getByRole('menuitem', { name: 'Отправить Push-уведомления выбранным' }).click();
  await page.waitForTimeout(600);
  await shot(page, 'e07-push-modal');
  const ta = dlg().locator('textarea');
  say('push textarea count', await ta.count());
  if (await ta.count()) await ta.fill('QA push');
  const send = dlg().getByRole('button', { name: 'Отправить' });
  say('push send disabled', await send.isDisabled());
  if (!(await send.isDisabled())) { await send.click(); await page.waitForTimeout(1500); say('push toast', await lastToast()); }
  await page.keyboard.press('Escape');
  await main.getByRole('button', { name: 'Excel' }).click();
  await page.getByRole('menuitem', { name: 'Выгрузить всю базу' }).click();
  await page.waitForTimeout(1500);
  say('export toast', await lastToast());
  await go(page, '/biz/network/clients/log');
  say('EXPORT LOG:', flat(await text(page), 300));
  await go(page, '/biz/network/clients');
  const name = (await rows.first().innerText()).split('\n').map((s) => s.trim()).filter(Boolean)[0];
  await main.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(2500);
  say('card url', page.url());
  say('CARD:', flat(await text(page), 500));
  await shot(page, 'e08-client-card');
  for (const tab of ['Доп. поля', 'История визитов', 'Отправленные сообщения', 'Лояльность', 'Счета клиентов']) {
    const tb = main.getByRole('tab', { name: tab });
    if (await tb.count()) { await tb.click(); await page.waitForTimeout(800); const t = await text(page); say(`tab ${tab}:`, flat(t.slice(t.lastIndexOf('Счета клиентов') + 14), 250)); }
    else say('no tab', tab);
  }
  // opt-out
  await main.getByRole('tab', { name: 'Карточка клиента' }).click().catch(() => {});
  await page.waitForTimeout(500);
  const sw = main.getByRole('switch').or(main.getByRole('checkbox', { name: /Не отправлять/ }));
  say('optout controls', await sw.count());
  await go(page, '/biz/network/clients/%2B37400000000');
  say('unknown client:', flat(await text(page), 150));
});
await step('analytics-records', async () => {
  await go(page, '/biz/network/analytics');
  say('ANALYTICS:', flat(await text(page), 700));
  await shot(page, 'e09-analytics', true);
  await go(page, '/biz/network/records');
  say('RECORDS:', flat(await text(page), 500));
  await shot(page, 'e10-records');
  await go(page, '/biz/network/loyalty');
  say('LOYALTY:', flat(await text(page), 300));
  await go(page, '/biz/network/staff/payroll');
  say('PAYROLL:', flat(await text(page), 300));
  const b = main.getByRole('button', { name: 'Создать ведомость и начислить' });
  if (await b.count()) { await b.click(); await page.waitForTimeout(1500); say('payroll toast', await lastToast(), flat(await text(page), 400)); }
  await go(page, '/biz/network/staff/off-days');
  say('OFFDAYS:', flat(await text(page), 300));
  await go(page, '/biz/network/services/subdivisions');
  say('SUBDIV:', flat(await text(page), 300));
  await go(page, '/biz/network/goods/stock');
  say('STOCK:', flat(await text(page), 300));
  await go(page, '/biz/network/goods/archive');
  say('ARCHIVE:', flat(await text(page), 300));
});
say('ERRORS', [...new Set(errors.filter((e) => !/DevTools|HMR|Fast Refresh/.test(e)))].slice(0, 8));
await ctx.close();
await browser.close();
