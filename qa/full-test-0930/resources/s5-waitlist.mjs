import { start, stop, ctx, open, goto, shot, area } from './lib.mjs';
const log = (...a) => console.log(...a);
const step = async (name, fn) => { try { await fn(); log('OK', name); } catch (e) { log('FAIL', name, e.message.split('\n')[0].slice(0, 200)); } };
await start();
try {
  const c = await ctx({});
  const p = await open(c, '/biz/waitlist');
  await step('interval without date blocked, with date saved', async () => {
    await p.getByRole('button', { name: 'Создать заявку' }).first().click();
    await p.waitForTimeout(700);
    const d = p.locator('[role=dialog]').last();
    await d.locator('input').first().fill('QA Интервал2');
    await d.locator('input[type=tel], input[inputmode=tel]').first().fill('91000444');
    await d.getByText('Выберите услуги').click(); await p.waitForTimeout(500);
    const pk = p.locator('[role=dialog]').last();
    await pk.getByText('Маникюр классический', { exact: true }).first().click();
    await pk.getByRole('button', { name: 'Готово' }).click(); await p.waitForTimeout(400);
    await d.getByText('Любое время в течение дня').click(); await p.waitForTimeout(300);
    await d.getByRole('button', { name: 'Создать заявку' }).click(); await p.waitForTimeout(800);
    log('date error shown:', await d.getByText('Выберите день для этого времени').count());
    await shot(p, 's5-01-date-required');
    // выбрать день через DatePicker
    await d.getByRole('button', { name: /Выберите дату|дату|Дата/ }).first().click().catch(async () => { await d.locator('button').filter({ hasText: /дат/i }).first().click(); });
    await p.waitForTimeout(600);
    await shot(p, 's5-02-datepicker');
    const day = p.locator('[role=dialog] button, [role=grid] button').filter({ hasText: /^3$/ }).first();
    await day.click().catch((e) => log('day click fail', e.message.slice(0, 80)));
    await p.waitForTimeout(400);
    await p.keyboard.press('Escape').catch(() => {});
    await shot(p, 's5-03-date-picked');
    await p.locator('[role=dialog]').last().getByRole('button', { name: 'Создать заявку' }).click().catch(() => {});
    await p.waitForTimeout(1500);
    const res = await area(p, 'resources');
    const e = ((res?.state ?? res)?.waitlist ?? []).find((w) => w.clientName === 'QA Интервал2');
    log('saved wishes:', JSON.stringify(e?.wishes));
    await shot(p, 's5-04-list');
  });
  await step('book any-staff → journal staff who does service', async () => {
    const row = p.locator('li').filter({ hasText: 'Маникюр классический' }).first();
    await row.locator('button').first().click(); await p.waitForTimeout(500);
    await p.locator('li').filter({ hasText: 'QA Интервал2' }).getByRole('button', { name: 'Записать' }).click();
    await p.waitForURL(/journal/, { timeout: 60000 }); await p.waitForTimeout(4000);
    log('url', decodeURIComponent(p.url()));
    await shot(p, 's5-05-journal');
  });
  await step('package create', async () => {
    await goto(p, '/biz/resources/packages/new');
    await p.locator('main input').first().fill('QA Пакет2');
    await p.locator('main').getByRole('button', { name: 'Новый пакет' }).last().click();
    await p.waitForURL(/packages\/pkg_/, { timeout: 120000 }); await p.waitForTimeout(3000);
    await shot(p, 's5-06-pkg', true);
    log('pkg text:', (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 700));
  });
  log('errors', p.errors);
} finally { await stop(); }
