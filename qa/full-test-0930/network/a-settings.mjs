// Сценарий A: управление сетью — переименование, главный филиал, убрать/вернуть филиал, копирование, заявка на удаление,
// удаление и восстановление сети, переключатель, создание второй сети.
import { connect, newPage, go, shot, text, toasts, audit } from './h.mjs';
const browser = await connect();
const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
const say = (...a) => console.log(...a);
const main = page.locator('main');
try {
  await go(page, '/biz/network');
  say('OVERVIEW:', (await text(page)).slice(0, 700).replace(/\n+/g, ' | '));
  await shot(page, 'a01-overview');

  await go(page, '/biz/network/settings');
  const t0 = await text(page);
  say('SETTINGS:', t0.slice(0, 1500).replace(/\n+/g, ' | '));
  await shot(page, 'a02-settings', true);
  // rename
  const nameInput = main.getByLabel('Название сети').first();
  const oldName = await nameInput.inputValue();
  await nameInput.fill(oldName + ' QA');
  await main.getByRole('button', { name: 'Сохранить' }).first().click();
  await page.waitForTimeout(1200);
  say('rename toast:', await toasts(page));
  await go(page, '/biz/network');
  say('overview title after rename:', (await text(page)).split('\n')[0], '|', (await page.locator('h1').first().innerText()));
  // audit
  await go(page, '/biz/network/settings');
  const auditTxt = (await text(page)).split('Изменения данных')[1]?.slice(0, 300);
  say('audit:', auditTxt?.replace(/\n+/g, ' | '));
  // empty name
  await nameInput.fill('   ');
  say('empty-name save disabled:', await main.getByRole('button', { name: 'Сохранить' }).first().isDisabled());
  await nameInput.fill(oldName);
  await main.getByRole('button', { name: 'Сохранить' }).first().click().catch(() => {});
  await page.waitForTimeout(800);

  // make main: second location
  const makeMain = main.getByRole('button', { name: 'Сделать главным' });
  say('makeMain buttons:', await makeMain.count());
  if (await makeMain.count()) {
    await makeMain.first().click();
    await page.waitForTimeout(1200);
    say('makeMain toast:', await toasts(page));
    await shot(page, 'a04-make-main');
    const rows = await main.locator('li').filter({ hasText: 'ID локации' }).allInnerTexts();
    say('rows after makeMain:', rows.map((r) => r.replace(/\n+/g, ' / ')));
  }
  // leave location (last) + confirm, then re-add
  const leaveBtns = main.getByRole('button', { name: 'Убрать из сети' });
  const n = await leaveBtns.count();
  say('leave buttons', n);
  const lastRow = main.locator('li').filter({ hasText: 'ID локации' }).last();
  const lastName = (await lastRow.innerText()).split('\n')[0];
  await leaveBtns.last().click();
  await page.waitForTimeout(500);
  await shot(page, 'a05-leave-confirm');
  await page.getByRole('button', { name: 'Убрать', exact: true }).click();
  await page.waitForTimeout(1200);
  say('leave toast:', await toasts(page));
  const rowsAfter = await main.locator('li').filter({ hasText: 'ID локации' }).allInnerTexts();
  say('rows after leave:', rowsAfter.map((r) => r.split('\n')[0]), 'removed:', lastName);
  await go(page, '/biz/network');
  say('overview branches after leave:', (await text(page)).match(/Филиалов\s*\n?\s*\d+/)?.[0]);
  // re-add
  await go(page, '/biz/network/settings');
  await main.getByRole('button', { name: 'Добавить', exact: true }).first().click();
  await page.waitForTimeout(1000);
  await shot(page, 'a06-add-dialog');
  const dlg = page.getByRole('dialog');
  say('add dialog:', (await dlg.innerText()).replace(/\n+/g, ' | '));
  const addBtn = dlg.getByRole('button', { name: 'Добавить', exact: true });
  if (await addBtn.count()) {
    await addBtn.first().click();
    await page.waitForTimeout(1200);
    say('add toast:', await toasts(page));
  }
  const rowsReadd = await main.locator('li').filter({ hasText: 'ID локации' }).allInnerTexts();
  say('rows after re-add:', rowsReadd.map((r) => r.split('\n')[0]));

  // request deletion
  await main.getByRole('button', { name: 'Запросить удаление' }).last().click();
  await page.waitForTimeout(600);
  await shot(page, 'a07-request-deletion');
  say('request dlg:', (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
  await page.getByRole('dialog').getByRole('button', { name: 'Отправить заявку' }).click();
  await page.waitForTimeout(1000);
  say('request toast:', await toasts(page));
  // second request of same location?
  await main.getByRole('button', { name: 'Запросить удаление' }).last().click();
  await page.waitForTimeout(600);
  say('request dlg 2nd time:', (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
  await page.keyboard.press('Escape');

  // copy data
  const copyBtn = main.getByRole('button', { name: 'Скопировать данные' });
  if (await copyBtn.count()) {
    await copyBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'a08-copy-dialog');
    say('copy dlg:', (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
    await page.getByRole('dialog').getByRole('button', { name: 'Скопировать', exact: true }).click();
    await page.waitForTimeout(1500);
    say('copy toast:', await toasts(page));
  }
  await page.keyboard.press('Escape');

  // switch screen
  await go(page, '/biz/network/switch');
  say('SWITCH:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 800));
  await shot(page, 'a09-switch');

  // create second network
  await go(page, '/biz/network/new');
  say('NEW:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 600));
  await main.getByRole('button', { name: 'Создать сеть' }).click();
  await page.waitForTimeout(600);
  say('new empty submit:', (await text(page)).match(/Введите название|Выберите хотя бы один филиал/g));
  await shot(page, 'a10-new-errors');
  await main.getByRole('textbox').first().fill('QA Вторая сеть');
  const boxes = main.getByRole('checkbox');
  say('candidate checkboxes', await boxes.count());
  if (await boxes.count()) {
    await boxes.first().click();
    await main.getByRole('button', { name: 'Создать сеть' }).click();
    await page.waitForTimeout(2000);
    say('created -> url', page.url(), await toasts(page));
    say('settings after create shows name:', await main.getByLabel('Название сети').first().inputValue().catch(() => '?'));
    await shot(page, 'a11-after-create');
  }
  await go(page, '/biz/network/switch');
  const sw = await text(page);
  say('SWITCH after create:', sw.replace(/\n+/g, ' | ').slice(0, 800));
  // open second network from switch
  const net2 = main.getByRole('button', { name: /QA Вторая сеть/ });
  if (await net2.count()) {
    await net2.first().click();
    await page.waitForTimeout(2500);
    say('clicked 2nd network -> url', page.url(), 'h1:', await page.locator('h1').first().innerText().catch(() => '?'));
    await shot(page, 'a12-open-second-network');
    // settings gear
    await go(page, '/biz/network/switch');
    const li = main.locator('li').filter({ hasText: 'QA Вторая сеть' });
    await li.getByRole('button', { name: 'Настройки сети' }).click();
    await page.waitForTimeout(2500);
    say('gear -> url', page.url(), 'name field:', await main.getByLabel('Название сети').first().inputValue().catch(() => '?'));
    // delete second network via trash in switch
    await go(page, '/biz/network/switch');
    await main.locator('li').filter({ hasText: 'QA Вторая сеть' }).getByRole('button', { name: 'Удалить сеть' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    await page.waitForTimeout(1500);
    say('delete toast', await toasts(page), 'still listed?', (await text(page)).includes('QA Вторая сеть'));
    const url2 = page.url();
  }
  // delete & restore own network through settings
  await go(page, '/biz/network/settings');
  await main.getByRole('button', { name: 'Удалить сеть' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'a13-delete-confirm');
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.waitForTimeout(1500);
  say('own delete toast', await toasts(page), 'url', page.url());
  await shot(page, 'a14-after-delete');
  say('after delete text:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 400));
  await go(page, '/biz/network/switch');
  say('switch after own delete:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 500));
  await go(page, '/biz/network');
  say('overview after own delete:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 300));
  await go(page, '/biz/network/settings');
  const restore = main.getByRole('button', { name: 'Восстановить сеть' });
  say('restore visible', await restore.count());
  if (await restore.count()) {
    await restore.click(); await page.waitForTimeout(1500);
    say('restore toast', await toasts(page));
    say('after restore:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 300));
  }
  await go(page, '/biz/network/settings');
  say('audit final:', (await text(page)).split('Изменения данных')[1]?.slice(0, 500).replace(/\n+/g, ' | '));
} catch (e) {
  say('FAIL', e.message.slice(0, 400));
  await shot(page, 'a-fail');
}
say('ERRORS', errors.filter((e) => !/DevTools|HMR|Fast Refresh/.test(e)));
await ctx.close();
await browser.close();
