// Сценарий H: добор после G — главный на обзоре, «уже отправлена», права пользователя сети, карточка клиента 2 филиалов
import { connect, newPage, go, shot, text, toasts } from './h.mjs';
const browser = await connect();
const say = (...a) => console.log(...a);
const flat = (s, n = 400) => s.replace(/\n+/g, ' | ').slice(0, n);
const lastToast = async (page) => (await toasts(page)).slice(-1)[0];
const clean = (errs) => [...new Set(errs.filter((e) => !/DevTools|HMR|Fast Refresh|\[api\] запрос не удался/.test(e)))].slice(0, 6);
async function step(page, name, fn) { try { await fn(); } catch (e) { say('STEP FAIL', name, e.message.split('\n')[0].slice(0, 200)); await shot(page, 'h-fail-' + name).catch(() => {}); } }
if (0) {
  const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
  const main = page.locator('main');
  const dlg = () => page.getByRole('dialog').last();
  await step(page, 'main-overview', async () => {
    await go(page, '/biz/network/settings');
    await main.getByRole('button', { name: 'Сделать главным' }).click();
    await page.waitForTimeout(1500);
    await go(page, '/biz/network');
    const rows = await main.locator('ul > li').allInnerTexts();
    say('overview rows:', rows.slice(0, 2).map((r) => flat(r, 90)));
    await shot(page, 'h01-overview-main');
    await go(page, '/biz/network/settings');
    await main.getByRole('button', { name: 'Запросить удаление' }).last().click();
    await page.waitForTimeout(500);
    await dlg().getByRole('button', { name: 'Отправить заявку' }).click();
    await page.waitForTimeout(1000);
    await main.getByRole('button', { name: 'Запросить удаление' }).last().click();
    await page.waitForTimeout(1200);
    say('2nd dialog:', flat(await dlg().innerText(), 300));
    await shot(page, 'h02-deletion-already');
    await page.keyboard.press('Escape');
  });
  await step(page, 'two-branch-card', async () => {
    await go(page, '/biz/network/clients/%2B37477560936');
    say('card:', flat(await text(page), 400));
    await shot(page, 'h03-two-branch-card');
    await main.getByRole('tab', { name: 'История визитов' }).click();
    await page.waitForTimeout(900);
    const t = await text(page);
    say('history:', flat(t.slice(t.lastIndexOf('Счета клиентов') + 14), 600));
    await shot(page, 'h04-two-branch-history', true);
  });
  say('ERRORS 1', clean(errors));
  await ctx.close();
}
{
  const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
  const main = page.locator('main');
  const dlg = () => page.getByRole('dialog').last();
  await step(page, 'member-perms', async () => {
    const nuriAdmin = { name: 'Лилит Мкртчян', phone: '+37400110002' };
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
    await go(page, '/biz/network/switch', { persona: 'admin' });
    say('admin switch (member):', flat(await text(page), 300));
    await go(page, '/biz/network/clients', { persona: 'admin' });
    say('admin clients:', flat(await text(page), 150));
    const sidebar = await page.evaluate(() => [...document.querySelectorAll('aside a, nav a')].map((a) => a.textContent.trim()).filter(Boolean));
    say('admin nav:', sidebar.join(' | ').slice(0, 900));
    await shot(page, 'h05-admin-member-clients');
    await go(page, '/biz/network/analytics', { persona: 'admin' });
    say('admin analytics:', flat(await text(page), 120));
    await go(page, '/biz/network', { persona: 'admin' });
    say('admin overview:', flat(await text(page), 120));
    await go(page, '/biz/network/settings', { persona: 'admin' });
    say('admin settings:', flat(await text(page), 120));
    await shot(page, 'h06-admin-member-denied');
    await go(page, '/biz/network/clients', { persona: 'master' });
    say('master clients:', flat(await text(page), 120));
  });
  say('ERRORS 2', clean(errors));
  await ctx.close();
}
await browser.close();
