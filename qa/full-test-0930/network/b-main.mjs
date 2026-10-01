// Сценарий B: пользователи, клиенты (поиск/рассылка/выгрузка/карточка), поля, должности, сотрудники, услуги, товары, телефония, планы
import { connect, newPage, go, shot, text, toasts } from './h.mjs';
const browser = await connect();
const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
const say = (...a) => console.log(...a);
const main = page.locator('main');
const flat = (s, n = 500) => s.replace(/\n+/g, ' | ').slice(0, n);
async function step(name, fn) { try { await fn(); } catch (e) { say('STEP FAIL', name, e.message.split('\n')[0].slice(0, 200)); await shot(page, 'b-fail-' + name).catch(() => {}); } }
const dlg = () => page.getByRole('dialog').last();

await step('users', async () => {
  await go(page, '/biz/network/settings/users');
  say('USERS:', flat(await text(page), 700));
  await shot(page, 'b01-users');
  await main.getByRole('button', { name: 'Пригласить' }).click();
  await page.waitForTimeout(500);
  await dlg().getByRole('button').filter({ hasText: /Пригласить|Отправить/ }).last().click();
  await page.waitForTimeout(500);
  say('invite empty:', flat(await dlg().innerText(), 300));
  await dlg().locator('input[type=tel], input').first().fill('77123456');
  await dlg().getByRole('button').filter({ hasText: /Пригласить|Отправить/ }).last().click();
  await page.waitForTimeout(1200);
  say('invite toast', await toasts(page));
  await page.keyboard.press('Escape');
  await main.getByRole('button', { name: 'Создать пользователя' }).click();
  await page.waitForTimeout(500);
  const inputs = dlg().locator('input');
  say('create inputs', await inputs.count());
  await inputs.nth(0).fill('QA Юзер');
  await inputs.nth(1).fill('qa.user');
  await inputs.nth(2).fill('secret123');
  await dlg().getByRole('button').filter({ hasText: /Создать/ }).last().click();
  await page.waitForTimeout(1200);
  say('create toast', await toasts(page));
  await page.keyboard.press('Escape');
  say('USERS after:', flat(await text(page), 900));
  await shot(page, 'b02-users-after');
  // open card of QA user
  await main.getByText('QA Юзер').first().click();
  await page.waitForTimeout(800);
  say('card:', flat(await dlg().innerText(), 400));
  await dlg().getByRole('tab', { name: 'Права' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'b03-user-perms');
  await dlg().getByRole('button', { name: 'Снять все' }).first().click();
  await dlg().getByRole('button', { name: 'Сохранить' }).last().click();
  await page.waitForTimeout(1000);
  say('perm save toast', await toasts(page));
  await page.keyboard.press('Escape');
  say('row after perms:', flat((await main.locator('tr, li').filter({ hasText: 'QA Юзер' }).first().innerText()), 200));
  // remove
  await main.getByText('QA Юзер').first().click();
  await page.waitForTimeout(600);
  await dlg().getByRole('button', { name: 'Убрать из сети' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('alertdialog').getByRole('button').last().click().catch(async () => { await page.getByRole('button', { name: /^Убрать$/ }).last().click(); });
  await page.waitForTimeout(1000);
  say('remove toast', await toasts(page), 'still there:', (await text(page)).includes('QA Юзер'));
});

let phone;
await step('clients', async () => {
  await go(page, '/biz/network/clients');
  const t = await text(page);
  say('CLIENTS:', flat(t, 600));
  await shot(page, 'b04-clients');
  const rows = main.locator('tbody tr');
  say('rows', await rows.count());
  const firstName = (await rows.first().innerText()).split('\n').filter(Boolean)[0];
  // search by part of name
  const q = firstName.split(' ')[0];
  await main.getByRole('searchbox').or(main.getByPlaceholder('Имя, телефон, email или номер карты')).first().fill(q);
  await main.getByRole('button', { name: 'Показать' }).click();
  await page.waitForTimeout(1200);
  say(`search "${q}" rows:`, await rows.count(), flat(await rows.first().innerText(), 150));
  await main.getByPlaceholder('Имя, телефон, email или номер карты').fill('zzzzqqq');
  await main.getByRole('button', { name: 'Показать' }).click();
  await page.waitForTimeout(1000);
  say('nonsense search:', flat(await text(page), 400));
  await shot(page, 'b05-clients-empty-search');
  await main.getByPlaceholder('Имя, телефон, email или номер карты').fill('');
  await main.getByRole('button', { name: 'Показать' }).click();
  await page.waitForTimeout(1000);
  // multi-branch clients
  const all = await rows.allInnerTexts();
  say('first rows:', all.slice(0, 4).map((r) => flat(r, 160)));
  // filters sheet
  await main.getByRole('button', { name: /Фильтры/ }).click();
  await page.waitForTimeout(600);
  await shot(page, 'b06-filters');
  say('filters sheet:', flat(await dlg().innerText(), 600));
  await page.keyboard.press('Escape');
  // sort by spend? select 2 rows
  await rows.nth(0).getByRole('checkbox').click();
  await rows.nth(1).getByRole('checkbox').click();
  say('selected text:', (await text(page)).match(/Выбрано: \d+/)?.[0]);
  await main.getByRole('button', { name: 'Рассылка' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('menuitem', { name: 'Отправить SMS выбранным' }).click();
  await page.waitForTimeout(700);
  say('sms modal:', flat(await dlg().innerText(), 600));
  await shot(page, 'b07-sms-modal');
  await dlg().locator('textarea').fill('QA тест рассылки');
  const send = dlg().getByRole('button', { name: 'Отправить' });
  say('send disabled w/o consent:', await send.isDisabled());
  await send.click({ trial: false }).catch(() => {});
  await page.waitForTimeout(600);
  say('after send w/o consent:', await toasts(page));
  await dlg().getByRole('checkbox').last().click();
  await send.click();
  await page.waitForTimeout(1500);
  say('sms send toast:', await toasts(page));
  await page.keyboard.press('Escape');
  // push
  await main.getByRole('button', { name: 'Рассылка' }).click();
  await page.getByRole('menuitem', { name: 'Отправить Push-уведомления выбранным' }).click();
  await page.waitForTimeout(600);
  say('push modal:', flat(await dlg().innerText(), 400));
  await dlg().locator('textarea').fill('QA push');
  await dlg().getByRole('checkbox').last().click().catch(() => {});
  await dlg().getByRole('button', { name: 'Отправить' }).click();
  await page.waitForTimeout(1500);
  say('push toast:', await toasts(page));
  await page.keyboard.press('Escape');
  // export
  await main.getByRole('button', { name: 'Excel' }).click();
  await page.getByRole('menuitem', { name: 'Выгрузить всю базу' }).click();
  await page.waitForTimeout(1500);
  say('export toast:', await toasts(page));
  await go(page, '/biz/network/clients/log');
  say('EXPORT LOG:', flat(await text(page), 400));
  await shot(page, 'b08-export-log');
  // client card
  await go(page, '/biz/network/clients');
  await rows.first().click();
  await page.waitForTimeout(2000);
  say('card url', page.url());
  phone = decodeURIComponent(page.url().split('/clients/')[1]?.split('?')[0] ?? '');
  say('CARD:', flat(await text(page), 700));
  await shot(page, 'b09-client-card');
  for (const tab of ['Доп. поля', 'История визитов', 'Отправленные сообщения', 'Лояльность', 'Счета клиентов']) {
    const tb = main.getByRole('tab', { name: tab });
    if (await tb.count()) { await tb.click(); await page.waitForTimeout(700); say(`tab ${tab}:`, flat(await text(page), 400).split('Счета клиентов').pop()); }
    else say('no tab', tab);
  }
  await shot(page, 'b10-client-card-accounts');
  await go(page, '/biz/network/clients/%2B37400000000');
  say('unknown client:', flat(await text(page), 200));
});

await step('fields', async () => {
  await go(page, '/biz/network/settings/fields');
  say('FIELDS:', flat(await text(page), 400));
  await main.getByRole('button', { name: 'Добавить поле' }).first().click();
  await page.waitForTimeout(600);
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(400);
  say('field empty save:', flat(await dlg().innerText(), 300));
  await dlg().getByLabel('Название').fill('QA Аллергия');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  say('field toast', await toasts(page), 'listed:', (await text(page)).includes('QA Аллергия'));
  await shot(page, 'b11-fields');
  // client tab field → visible in client card
  await main.getByRole('tab', { name: 'Доп. данные клиента' }).click();
  await main.getByRole('button', { name: 'Добавить поле' }).first().click();
  await page.waitForTimeout(500);
  await dlg().getByLabel('Название').fill('QA Любимый цвет');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  say('client field listed:', (await text(page)).includes('QA Любимый цвет'));
  if (phone) {
    await go(page, `/biz/network/clients/${encodeURIComponent(phone)}`);
    await main.getByRole('tab', { name: 'Доп. поля' }).click();
    await page.waitForTimeout(700);
    say('card has client field:', (await text(page)).includes('QA Любимый цвет'));
  }
});

await step('positions', async () => {
  await go(page, '/biz/network/staff/positions');
  say('POSITIONS:', flat(await text(page), 400));
  await main.getByRole('button', { name: 'Добавить должность' }).first().click();
  await page.waitForTimeout(500);
  await dlg().getByLabel('Название').first().fill('QA Стилист');
  await dlg().getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  say('pos toast', await toasts(page), 'listed', (await text(page)).includes('QA Стилист'));
  await go(page, '/biz/network/staff');
  say('STAFF:', flat(await text(page), 500));
  await shot(page, 'b12-staff');
});

await step('staff-new', async () => {
  await go(page, '/biz/network/staff/new');
  await main.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(500);
  say('staff empty save:', (await text(page)).match(/Введите имя|Введите телефон|Отметьте хотя бы один филиал/g));
  await main.getByLabel('Имя').first().fill('QA Мастер Сети');
  await main.locator('input[type=tel]').first().fill('77999111');
  const cbs = main.getByRole('checkbox');
  say('branch checkboxes', await cbs.count());
  await cbs.first().click();
  await main.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1500);
  say('staff toast', await toasts(page), page.url());
  await go(page, '/biz/network/staff');
  say('staff listed', (await text(page)).includes('QA Мастер Сети'));
  // visible in branch staff (owner persona view)
  await go(page, '/biz/staff', { persona: 'network' });
  say('in /biz/staff:', (await text(page)).includes('QA Мастер Сети'));
});

await step('services', async () => {
  await go(page, '/biz/network/services');
  say('SERVICES:', flat(await text(page), 500));
  await shot(page, 'b13-services');
});
await step('goods', async () => {
  await go(page, '/biz/network/goods');
  say('GOODS:', flat(await text(page), 500));
  await shot(page, 'b14-goods');
});
await step('telephony', async () => {
  await go(page, '/biz/network/telephony');
  say('TEL:', flat(await text(page), 400));
  const c = main.getByRole('button', { name: 'Подключить телефонию' });
  if (await c.count()) { await c.click(); await page.waitForTimeout(1200); say('tel toast', await toasts(page)); }
  await main.getByRole('button', { name: 'Добавить маршрут' }).click().catch(() => say('no add route'));
  await page.waitForTimeout(500);
  if (await page.getByRole('dialog').count()) {
    await dlg().getByLabel('Название маршрута').fill('QA маршрут');
    await dlg().getByRole('button', { name: 'Сохранить' }).click();
    await page.waitForTimeout(1200);
    say('route toast', await toasts(page), 'listed', (await text(page)).includes('QA маршрут'));
  }
  await shot(page, 'b15-telephony', true);
});
await step('plans', async () => {
  await go(page, '/biz/network/settings/plans');
  say('PLANS:', flat(await text(page), 400));
  const inp = main.locator('input').first();
  await inp.fill('123456'); await inp.blur(); await page.waitForTimeout(1200);
  await go(page, '/biz/network/settings/plans');
  say('plan persisted:', await main.locator('input').first().inputValue());
  await shot(page, 'b16-plans');
});
say('ERRORS', errors.filter((e) => !/DevTools|HMR|Fast Refresh/.test(e)));
await ctx.close();
await browser.close();
