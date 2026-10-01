// Сценарий J (01.10): права сети режет сама API-функция; ошибка консоли owner-empty; смена персоны и сброс демо
import { connect, newPage, go, shot, text, toasts } from './h.mjs';
const browser = await connect();
const say = (...a) => console.log(...a);
const flat = (s, n = 300) => s.replace(/\n+/g, ' | ').slice(0, n);
async function step(page, name, fn) { try { await fn(); } catch (e) { say('STEP FAIL', name, e.message.split('\n')[0].slice(0, 200)); await shot(page, 'j-fail-' + name).catch(() => {}); } }
const callApi = (page, fn, args) => page.evaluate(async ([fn, args]) => {
  const api = window.__bpNetworkApi;
  if (!api) return 'NO API HANDLE';
  try { const r = await api[fn](...args); return 'OK ' + JSON.stringify(r).slice(0, 80); } catch (e) { return 'ERR ' + (e.code ?? e.name) + ' ' + (e.message ?? '').slice(0, 80); }
}, [fn, args]);
if (0) {
  const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
  const main = page.locator('main'); const dlg = () => page.getByRole('dialog').last();
  await step(page, 'api-perms', async () => {
    await go(page, '/biz/network/settings/users', { persona: 'owner' });
    await main.getByRole('button', { name: 'Создать пользователя' }).click();
    await page.waitForTimeout(400);
    await dlg().getByLabel('Имя').fill('Лилит Мкртчян');
    await dlg().locator('input[type=tel]').fill('00110002');
    await dlg().getByLabel('Логин').fill('nuri.admin');
    await dlg().getByLabel('Пароль').fill('secret123');
    await dlg().getByRole('button', { name: 'Создать пользователя' }).click();
    await page.waitForTimeout(1200);
    await main.getByText('Лилит Мкртчян').first().click();
    await page.waitForTimeout(600);
    await dlg().getByRole('tab', { name: 'Права' }).click();
    await dlg().getByRole('checkbox', { name: 'Просматривать клиентскую базу' }).click();
    await dlg().getByRole('button', { name: 'Сохранить' }).last().click();
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    const netId = await page.evaluate(() => JSON.parse(localStorage.getItem('bp-mock-db:core:networks')).find((n) => n.name === 'Nuri Nail Studio')?.id);
    say('nuri network', netId);
    // владелец — всё можно
    say('owner analytics:', await callApi(page, 'getNetworkAnalyticsSummary', [netId, '2026-09-01', '2026-09-30']));
    // администратор с правом «Клиенты»
    await go(page, '/biz/network/clients', { persona: 'admin' });
    say('admin clients page:', flat(await text(page), 80));
    say('admin listNetworkClients:', await callApi(page, 'listNetworkClients', [netId, {}]));
    say('admin analytics summary:', await callApi(page, 'getNetworkAnalyticsSummary', [netId, '2026-09-01', '2026-09-30']));
    say('admin finance summary:', await callApi(page, 'getNetworkFinanceSummary', [netId, '2026-09-01', '2026-09-30']));
    say('admin renameNetwork:', await callApi(page, 'renameNetwork', [netId, 'Взлом']));
    say('admin listNetworkAuditLog:', await callApi(page, 'listNetworkAuditLog', [netId]));
    say('admin createNetworkUser:', await callApi(page, 'createNetworkUser', [netId, { name: 'X', login: 'x', password: 'y' }]));
    say('admin saveNetworkField:', await callApi(page, 'deleteNetworkField', [netId, 'nope']));
    await go(page, '/biz/network', { persona: 'admin' });
    say('admin overview has finance card?', /Финансы сети/.test(await text(page)));
    // мастер без членства
    await go(page, '/biz/network/switch', { persona: 'master' });
    say('master listNetworkClients:', await callApi(page, 'listNetworkClients', [netId, {}]));
  });
  await ctx.close();
}
{
  const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
  await step(page, 'owner-empty-clients', async () => {
    for (const [p, e] of [['owner', '&empty=0'], ['admin', '&empty=0'], ['master', '&empty=0']]) for (const r of ['/biz/network', '/biz/network/clients', '/biz/network/switch']) await go(page, r, { persona: p, extra: e });
    await go(page, '/biz/network', { persona: 'owner', extra: '&empty=1' });
    errors.length = 0;
    await go(page, '/biz/network/clients', { persona: 'owner', extra: '&empty=1' });
    await page.waitForTimeout(1500);
    say('owner-empty clients errors:', errors);
  });
  await ctx.close();
}
{
  const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
  await step(page, 'persona-reset', async () => {
    await go(page, '/biz/network/settings', { persona: 'network' });
    const name = page.locator('main').getByLabel('Название сети').first();
    await name.fill('Manana QA-персист');
    await page.locator('main').getByRole('button', { name: 'Сохранить' }).first().click();
    await page.waitForTimeout(1500);
    await go(page, '/biz/network', { persona: 'owner' });
    say('owner sees:', await page.locator('h1').first().innerText());
    await go(page, '/biz/network', { persona: 'network' });
    say('network after persona switch back:', await page.locator('h1').first().innerText());
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
    say('network after reload:', await page.locator('h1').first().innerText());
    // сброс демо через панель
    await page.evaluate(() => document.querySelector('[data-demo-fab]')?.click());
    await page.waitForTimeout(800);
    const reset = page.getByRole('button', { name: 'Сбросить демо-данные' });
    say('reset button', await reset.count());
    await reset.first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Сбросить демо-данные' }).last().click();
    await page.waitForTimeout(2000);
    say('reset toast:', (await toasts(page)).slice(-1)[0]);
    await go(page, '/biz/network', { persona: 'network' });
    say('after reset h1:', await page.locator('h1').first().innerText());
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
    say('after reset+reload h1:', await page.locator('h1').first().innerText());
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bp-mock-db')));
    say('storage keys after reset:', keys.join(', '));
    // правка сразу после сброса сохраняется
    await go(page, '/biz/network/settings', { persona: 'network' });
    await page.locator('main').getByLabel('Название сети').first().fill('После сброса');
    await page.locator('main').getByRole('button', { name: 'Сохранить' }).first().click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
    await go(page, '/biz/network', { persona: 'network' });
    say('edit after reset persisted:', await page.locator('h1').first().innerText());
  });
  say('ERRORS persona-reset', [...new Set(errors.filter((e) => !/DevTools|HMR|Fast Refresh/.test(e)))].slice(0, 5));
  await ctx.close();
}
await browser.close();
