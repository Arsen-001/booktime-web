// Сценарий G (01.10): решения владельца — главный одним нажатием, «заявка уже отправлена», выбор сети,
// удалённая сеть без пересоздания, «вас не добавили», права пользователя сети, клиент из 2 филиалов, карточка на телефоне
import { connect, newPage, go, shot, text, toasts } from './h.mjs';
const browser = await connect();
const say = (...a) => console.log(...a);
const flat = (s, n = 400) => s.replace(/\n+/g, ' | ').slice(0, n);
const lastToast = async (page) => (await toasts(page)).slice(-1)[0];
const clean = (errs) => [...new Set(errs.filter((e) => !/DevTools|HMR|Fast Refresh|\[api\] запрос не удался/.test(e)))].slice(0, 6);
async function step(page, name, fn) { try { await fn(); } catch (e) { say('STEP FAIL', name, e.message.split('\n')[0].slice(0, 200)); await shot(page, 'g-fail-' + name).catch(() => {}); } }

{
  const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
  const main = page.locator('main');
  const dlg = () => page.getByRole('dialog').last();
  await step(page, 'make-main', async () => {
    await go(page, '/biz/network/settings');
    await main.getByRole('button', { name: 'Сделать главным' }).click();
    await page.waitForTimeout(1500);
    say('makeMain toast:', await lastToast(page));
    say('rows:', (await main.locator('li').filter({ hasText: 'ID локации' }).allInnerTexts()).map((r) => flat(r, 90)));
    await shot(page, 'g01-make-main');
    await go(page, '/biz/network');
    say('overview main badge row:', flat((await main.locator('li').filter({ hasText: 'Главный филиал' }).first().innerText()), 80));
  });
  await step(page, 'deletion-twice', async () => {
    await go(page, '/biz/network/settings');
    await main.getByRole('button', { name: 'Запросить удаление' }).last().click();
    await page.waitForTimeout(500);
    await dlg().getByRole('button', { name: 'Отправить заявку' }).click();
    await page.waitForTimeout(1000);
    say('1st request:', await lastToast(page));
    await main.getByRole('button', { name: 'Запросить удаление' }).last().click();
    await page.waitForTimeout(1000);
    say('2nd dialog:', flat(await dlg().innerText(), 300));
    await shot(page, 'g02-deletion-already');
    await page.keyboard.press('Escape');
  });
  await step(page, 'select-network', async () => {
    await go(page, '/biz/network/new');
    await main.getByRole('textbox').first().fill('QA Вторая сеть');
    await main.getByRole('checkbox').first().click();
    await main.getByRole('button', { name: 'Создать сеть' }).click();
    await page.waitForTimeout(2000);
    await go(page, '/biz/network/switch');
    await main.getByRole('button', { name: /QA Вторая сеть/ }).first().click();
    await page.waitForURL(/\/biz\/network$/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    say('open 2nd network h1:', await page.locator('h1').first().innerText());
    await shot(page, 'g03-second-network');
    await go(page, '/biz/network/switch');
    await main.getByRole('button', { name: /^Manana Beauty$/ }).first().click();
    await page.waitForURL(/\/biz\/network$/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    say('open Manana h1:', await page.locator('h1').first().innerText());
  });
  await step(page, 'deleted-network', async () => {
    // сначала удалить вторую сеть, потом свою единственную
    await go(page, '/biz/network/switch');
    await main.locator('li').filter({ hasText: 'QA Вторая сеть' }).getByRole('button', { name: 'Удалить сеть' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    await page.waitForTimeout(1500);
    await go(page, '/biz/network/settings');
    await main.getByRole('button', { name: 'Удалить сеть' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Удалить', exact: true }).click();
    await page.waitForTimeout(1500);
    await go(page, '/biz/network/switch');
    say('switch after deleting all:', flat(await text(page), 400));
    await shot(page, 'g04-switch-no-networks');
    await go(page, '/biz/network');
    say('overview after deleting all:', flat(await text(page), 300));
    await shot(page, 'g05-deleted-gate');
    await go(page, '/biz/network/clients');
    say('clients after deleting all:', flat(await text(page), 150));
    await go(page, '/biz/network');
    await main.getByRole('button', { name: 'Восстановить сеть' }).click();
    await page.waitForTimeout(2000);
    say('restore toast:', await lastToast(page), 'h1:', await page.locator('h1').first().innerText().catch(() => '?'));
    await go(page, '/biz/network/switch');
    say('switch after restore:', flat(await text(page), 400));
  });
  await step(page, 'two-branch-client', async () => {
    await go(page, '/biz/network/clients');
    const rows = await main.locator('tbody tr').allInnerTexts();
    // пройти страницы не нужно: фильтр «Посещал» обе локации
    await main.getByRole('button', { name: /Фильтры/ }).click();
    await page.waitForTimeout(500);
    const sheet = page.getByRole('dialog').last();
    // выбрать сортировку по числу визитов не нужно — ищем строку с «2 филиала» через поиск по страницам
    await page.keyboard.press('Escape');
    let found = rows.find((r) => /2 филиала/.test(r));
    for (let i = 0; i < 12 && !found; i++) {
      const next = main.getByRole('button', { name: /Следующая|Next/ });
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click(); await page.waitForTimeout(600);
      found = (await main.locator('tbody tr').allInnerTexts()).find((r) => /2 филиала/.test(r));
    }
    say('row with 2 branches:', found ? flat(found, 200) : 'НЕТ');
    if (found) {
      const name = found.split('\n').map((s) => s.trim()).filter(Boolean)[0];
      await main.getByText(name, { exact: true }).first().click();
      await page.waitForTimeout(2500);
      say('2-branch card:', flat(await text(page), 400));
      await shot(page, 'g06-two-branch-card');
      globalThis.__twoBranchPhone = decodeURIComponent(page.url().split('/clients/')[1] ?? '');
    }
  });
  say('ERRORS desktop network', clean(errors));
  await ctx.close();
}

if (0) // Права пользователя сети: владелец Nuri добавляет администратора Nuri пользователем сети с одним правом «Клиенты»
{
  const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
  const main = page.locator('main');
  const dlg = () => page.getByRole('dialog').last();
  await step(page, 'member-perms', async () => {
    await go(page, '/biz/network/switch', { persona: 'admin' });
    say('admin switch (not member):', flat(await text(page), 300));
    await shot(page, 'g07-admin-not-member');
    const nav = async () => (await page.locator('nav, aside').first().innerText()).replace(/\n+/g, ' | ');
    say('admin nav has network?', /Сеть и филиалы/.test(await nav()));
    await go(page, '/biz/network/switch', { persona: 'owner' });
    const staff = await page.evaluate(() => {
      const raw = localStorage.getItem('bp-mock-db:core:staff');
      const j = raw ? JSON.parse(raw) : null; const list = j?.state ?? j?.data ?? j;
      return Array.isArray(list) ? list.filter((s) => s.role === 'admin').map((s) => ({ id: s.id, businessId: s.businessId, phone: s.phone, name: s.name })) : String(raw).slice(0, 100);
    });
    const nuriAdmin = Array.isArray(staff) ? staff.find((s) => /nuri/.test(s.businessId)) : undefined;
    say('nuri admin:', JSON.stringify(nuriAdmin));
    await go(page, '/biz/network/settings/users', { persona: 'owner' });
    await main.getByRole('button', { name: 'Создать пользователя' }).click();
    await page.waitForTimeout(400);
    await dlg().getByLabel('Имя').fill(nuriAdmin.name);
    await dlg().locator('input[type=tel]').fill(nuriAdmin.phone.replace(/^\+374/, ''));
    await dlg().getByLabel('Логин').fill('nuri.admin');
    await dlg().getByLabel('Пароль').fill('secret123');
    await dlg().getByRole('button', { name: 'Создать пользователя' }).click();
    await page.waitForTimeout(1200);
    say('create toast', await lastToast(page));
    await main.getByText(nuriAdmin.name).first().click();
    await page.waitForTimeout(600);
    await dlg().getByRole('tab', { name: 'Права' }).click();
    await dlg().getByRole('checkbox', { name: 'Просматривать клиентскую базу' }).click();
    await dlg().getByRole('button', { name: 'Сохранить' }).last().click();
    await page.waitForTimeout(1000);
    say('perm toast', await lastToast(page));
    await page.keyboard.press('Escape');
    // теперь как администратор
    await go(page, '/biz/network/switch', { persona: 'admin' });
    say('admin switch (member):', flat(await text(page), 300));
    await go(page, '/biz/network/clients', { persona: 'admin' });
    say('admin clients:', flat(await text(page), 150));
    const sidebar = await page.evaluate(() => [...document.querySelectorAll('nav a, aside a')].map((a) => a.textContent.trim()).filter(Boolean));
    say('admin nav:', sidebar.join(' | ').slice(0, 900));
    await shot(page, 'g08-admin-member-clients');
    await go(page, '/biz/network/analytics', { persona: 'admin' });
    say('admin analytics:', flat(await text(page), 120));
    await go(page, '/biz/network/settings', { persona: 'admin' });
    say('admin settings:', flat(await text(page), 120));
    await shot(page, 'g09-admin-member-denied');
    await go(page, '/biz/network/clients', { persona: 'master' });
    say('master clients:', flat(await text(page), 120));
  });
  say('ERRORS perms', clean(errors));
  await ctx.close();
}

// Карточка клиента на телефоне
{
  const { ctx, page, errors } = await newPage(browser, { device: 'phone' });
  const main = page.locator('main');
  await step(page, 'phone-card', async () => {
    const phone = globalThis.__twoBranchPhone || '+37477102458';
    await go(page, `/biz/network/clients/${encodeURIComponent(phone)}`);
    say('phone card:', flat(await text(page), 400));
    await shot(page, 'g10-phone-card');
    for (const tab of ['История визитов', 'Лояльность', 'Счета клиентов', 'Отправленные сообщения', 'Доп. поля']) {
      const tb = main.getByRole('tab', { name: tab });
      if (!(await tb.count())) { say('phone no tab', tab); continue; }
      await tb.click(); await page.waitForTimeout(900);
      const t = await text(page);
      say(`phone tab ${tab}:`, flat(t.slice(t.lastIndexOf('Счета клиентов') + 14), 300));
      await shot(page, `g11-phone-${tab.replace(/[^А-Яа-я]+/g, '')}`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    say('phone overflow:', overflow);
    await go(page, '/biz/network/clients');
    say('phone list first card:', flat((await main.locator('li, tr, [role=row]').filter({ hasText: 'филиал' }).first().innerText().catch(() => '?')), 150));
    await shot(page, 'g12-phone-clients');
  });
  say('ERRORS phone', clean(errors));
  await ctx.close();
}
await browser.close();
