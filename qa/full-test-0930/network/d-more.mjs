// Сценарий D: добор после B — создание пользователя, push/выгрузка/карточка клиента, поле с ключом API, маршрут телефонии
import { connect, newPage, go, shot, text, toasts } from './h.mjs';
const browser = await connect();
const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
const say = (...a) => console.log(...a);
const main = page.locator('main');
const flat = (s, n = 500) => s.replace(/\n+/g, ' | ').slice(0, n);
async function step(name, fn) { try { await fn(); } catch (e) { say('STEP FAIL', name, e.message.split('\n')[0].slice(0, 200)); await shot(page, 'd-fail-' + name).catch(() => {}); } }
const dlg = () => page.getByRole('dialog').last();
const lastToast = async () => (await toasts(page)).slice(-1)[0];

await step('user-create', async () => {
  await go(page, '/biz/network/settings/users');
  await main.getByRole('button', { name: 'Создать пользователя' }).click();
  await page.waitForTimeout(500);
  await dlg().getByRole('button', { name: 'Создать пользователя' }).click();
  await page.waitForTimeout(300);
  say('create empty:', flat(await dlg().innerText(), 200));
  await dlg().getByLabel('Имя').fill('QA Юзер');
  await dlg().getByLabel('Логин').fill('qa.user');
  await dlg().getByLabel('Пароль').fill('secret123');
  await dlg().getByRole('button', { name: 'Создать пользователя' }).click();
  await page.waitForTimeout(1200);
  say('create toast', await lastToast(), 'listed', (await text(page)).includes('QA Юзер'));
  await main.getByText('QA Юзер').first().click();
  await page.waitForTimeout(700);
  say('user card:', flat(await dlg().innerText(), 300));
  await dlg().getByRole('tab', { name: 'Права' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'd01-user-perms');
  say('perms tab:', flat(await dlg().innerText(), 700));
  await dlg().getByRole('button', { name: 'Дать все' }).first().click();
  const saveBtn = dlg().getByRole('button', { name: 'Сохранить' }).last();
  say('perm save enabled after toggle:', !(await saveBtn.isDisabled()));
  if (!(await saveBtn.isDisabled())) { await saveBtn.click(); await page.waitForTimeout(1000); say('perm toast', await lastToast()); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  say('row:', flat(await main.locator('tr').filter({ hasText: 'QA Юзер' }).first().innerText(), 200));
  await main.getByText('QA Юзер').first().click();
  await page.waitForTimeout(600);
  await dlg().getByRole('button', { name: 'Убрать из сети' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'd02-user-remove-confirm');
  await page.getByRole('button', { name: /^Убрать/ }).last().click();
  await page.waitForTimeout(1200);
  say('remove toast', await lastToast(), 'still listed', (await text(page)).includes('QA Юзер'));
});

await step('clients-push-export-card', async () => {
  await go(page, '/biz/network/clients');
  const rows = main.locator('tbody tr');
  // clients with >1 branch
  const all = await rows.allInnerTexts();
  say('rows', all.length, 'multi-branch rows:', all.filter((r) => /\t[2-9]\s*$/.test(r)).length);
  await rows.nth(0).getByRole('checkbox').click();
  await main.getByRole('button', { name: 'Рассылка' }).click();
  await page.getByRole('menuitem', { name: 'Отправить Push-уведомления выбранным' }).click();
  await page.waitForTimeout(600);
  say('push modal:', flat(await dlg().innerText(), 400));
  await dlg().locator('textarea').fill('QA push');
  await dlg().getByRole('checkbox').last().click();
  const send = dlg().getByRole('button', { name: 'Отправить' });
  say('push send disabled:', await send.isDisabled());
  if (!(await send.isDisabled())) { await send.click(); await page.waitForTimeout(1500); say('push toast:', await lastToast()); }
  await page.keyboard.press('Escape');
  await main.getByRole('button', { name: 'Excel' }).click();
  await page.getByRole('menuitem', { name: 'Выгрузить всю базу' }).click();
  await page.waitForTimeout(1500);
  say('export toast:', await lastToast());
  await go(page, '/biz/network/clients/log');
  say('EXPORT LOG:', flat(await text(page), 400));
  await shot(page, 'd03-export-log');
  await go(page, '/biz/network/clients');
  await rows.first().locator('td').nth(1).click();
  await page.waitForTimeout(2500);
  say('card url', page.url());
  say('CARD:', flat(await text(page), 700));
  await shot(page, 'd04-client-card');
  for (const tab of ['Доп. поля', 'История визитов', 'Отправленные сообщения', 'Лояльность', 'Счета клиентов']) {
    const tb = main.getByRole('tab', { name: tab });
    if (await tb.count()) { await tb.click(); await page.waitForTimeout(800); const t = await text(page); say(`tab ${tab}:`, flat(t.slice(t.indexOf('Счета клиентов') + 14), 300)); }
    else say('no tab', tab);
  }
  await shot(page, 'd05-client-card-tab');
  await go(page, '/biz/network/clients/%2B37400000000');
  say('unknown client:', flat(await text(page), 200));
});

await step('fields', async () => {
  await go(page, '/biz/network/settings/fields');
  await main.getByRole('button', { name: 'Добавить поле' }).first().click();
  await page.waitForTimeout(600);
  await dlg().getByLabel('Название').fill('QA Аллергия');
  await dlg().getByLabel('Ключ API').fill('кириллица');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(400);
  say('bad api key:', ((await dlg().innerText()).match(/Допустимы[^\n]*/) ?? [])[0]);
  await dlg().getByLabel('Ключ API').fill('qa_allergy');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  say('field toast', await lastToast(), 'listed:', (await text(page)).includes('QA Аллергия'));
  await shot(page, 'd06-fields');
  await main.getByRole('tab', { name: 'Доп. данные клиента' }).click();
  await page.waitForTimeout(400);
  await main.getByRole('button', { name: 'Добавить поле' }).first().click();
  await page.waitForTimeout(500);
  await dlg().getByLabel('Название').fill('QA Любимый цвет');
  await dlg().getByLabel('Ключ API').fill('qa_color');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  say('client field listed:', (await text(page)).includes('QA Любимый цвет'));
  // delete with word
  await go(page, '/biz/network/clients');
  await main.locator('tbody tr').first().locator('td').nth(1).click();
  await page.waitForTimeout(2000);
  await main.getByRole('tab', { name: 'Доп. поля' }).click();
  await page.waitForTimeout(800);
  say('card has client field:', (await text(page)).includes('QA Любимый цвет'));
});

await step('telephony-route', async () => {
  await go(page, '/biz/network/telephony');
  const c = main.getByRole('button', { name: 'Подключить телефонию' });
  if (await c.count()) { await c.click(); await page.waitForTimeout(1200); }
  await main.getByRole('button', { name: 'Добавить маршрут' }).click();
  await page.waitForTimeout(600);
  await dlg().getByLabel('Название маршрута').fill('QA маршрут');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  say('route toast', await lastToast(), 'dialog open', await page.getByRole('dialog').count(), flat(await dlg().innerText().catch(() => ''), 300));
  await page.keyboard.press('Escape');
  say('route listed', (await text(page)).includes('QA маршрут'));
  await shot(page, 'd07-telephony', true);
});
say('ERRORS', [...new Set(errors.filter((e) => !/DevTools|HMR|Fast Refresh/.test(e)))]);
await ctx.close();
await browser.close();
