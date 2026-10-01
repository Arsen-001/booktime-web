// Действия: пакет → онлайн-запись; заявка с интервалом → правка; «Записать» → журнал с клиентом; ресурс → создать/удалить
import { start, stop, ctx, open, goto, shot, area } from './lib.mjs';
const log = (...a) => console.log(...a);
const step = async (name, fn) => { try { await fn(); log('OK', name); } catch (e) { log('FAIL', name, e.message.split('\n')[0].slice(0, 200)); } };
await start();
try {
  const c = await ctx({});
  const p = await open(c, '/biz/resources/packages/new');
  // ── Пакет
  await step('package create', async () => {
    await p.locator('main input').first().fill('QA Пакет');
    await shot(p, 's3-01-pkg-new');
    await p.locator('main').getByRole('button', { name: 'Новый пакет' }).last().click();
    await p.waitForURL(/packages\/(?!new)/, { timeout: 20000 });
    await p.waitForTimeout(2000);
    await shot(p, 's3-02-pkg-form', true);
    log('pkg url', p.url());
  });
  await step('package add services', async () => {
    await p.getByText('Выберите услуги').first().click();
    await p.waitForTimeout(600);
    const d = p.locator('[role=dialog]').last();
    await d.getByText('Маникюр классический', { exact: true }).first().click();
    await d.getByText('Снятие покрытия', { exact: true }).first().click();
    await d.getByRole('button', { name: 'Готово' }).click();
    await p.waitForTimeout(800);
    const online = p.getByRole('tab', { name: 'Онлайн-запись' });
    await shot(p, 's3-03-pkg-services', true);
    log('pkg text:', (await p.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 900));
    await online.click().catch(() => {});
    await p.waitForTimeout(500);
    const sw = p.getByRole('switch', { name: /Показывать в онлайн-записи/ });
    if (await sw.count()) { await sw.first().click(); }
    await shot(p, 's3-04-pkg-online', true);
    await p.getByRole('button', { name: 'Сохранить' }).last().click();
    await p.waitForTimeout(2000);
    await shot(p, 's3-05-pkg-saved', true);
  });
  const core = await p.evaluate(() => { const k = Object.keys(localStorage).filter((x) => x.includes(':core:services')); return k.map((x) => localStorage.getItem(x)).join('').slice(0, 0) || k; });
  log('core keys', core);
  const pkg = await p.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (!k.includes('services')) continue;
      const v = localStorage.getItem(k); if (!v || !v.includes('QA Пакет')) continue;
      const j = JSON.parse(v); const arr = JSON.stringify(j);
      const m = arr.indexOf('QA Пакет'); return arr.slice(Math.max(0, m - 400), m + 600);
    }
    return null;
  });
  log('pkg stored:', pkg);
  await step('package in online widget', async () => {
    await goto(p, '/b/nuri-nail-studio');
    await p.waitForTimeout(1500);
    const has = await p.getByText('QA Пакет').count();
    log('QA Пакет on public page count:', has);
    if (has) { await p.getByText('QA Пакет').first().scrollIntoViewIfNeeded(); await shot(p, 's3-06-public-pkg'); log('row:', (await p.getByText('QA Пакет').first().locator('xpath=ancestor::*[self::li or self::a or self::button][1]').innerText().catch(() => '')).replace(/\n/g, ' | ')); }
  });
  await step('package in journal service picker', async () => {
    await goto(p, '/biz/journal?new=1');
    await p.waitForTimeout(2500);
    await shot(p, 's3-07-journal-new');
  });

  // ── Лист ожидания: интервал и «Записать»
  await step('waitlist interval', async () => {
    await goto(p, '/biz/waitlist');
    await p.getByRole('button', { name: 'Создать заявку' }).first().click();
    await p.waitForTimeout(700);
    const d = p.locator('[role=dialog]').last();
    await d.locator('input').first().fill('QA Интервал');
    await d.locator('input[type=tel], input[inputmode=tel]').first().fill('91000222');
    await d.getByText('Выберите услуги').click();
    await p.waitForTimeout(500);
    const pk = p.locator('[role=dialog]').last();
    await pk.getByText('Маникюр классический', { exact: true }).first().click();
    await pk.getByRole('button', { name: 'Готово' }).click();
    await p.waitForTimeout(400);
    await d.getByText('Любое время в течение дня').click();
    await p.waitForTimeout(300);
    await shot(p, 's3-08-wl-interval');
    await d.getByRole('button', { name: 'Создать заявку' }).click();
    await p.waitForTimeout(1500);
    const res = await area(p, 'resources');
    const e = ((res?.state ?? res)?.waitlist ?? []).find((w) => w.clientName === 'QA Интервал');
    log('interval entry wishes:', JSON.stringify(e?.wishes));
    await shot(p, 's3-09-wl-list');
  });
  await step('waitlist book → journal prefilled', async () => {
    await p.locator('li', { hasText: 'Маникюр классический' }).filter({ hasText: 'Любой' }).first().locator('button').first().click().catch(() => {});
    const row = p.locator('li').filter({ hasText: 'QA Интервал' });
    if (!(await row.count())) { await p.getByText('Маникюр классический').first().click(); await p.waitForTimeout(500); }
    await p.locator('li').filter({ hasText: 'QA Интервал' }).getByRole('button', { name: 'Записать' }).click();
    await p.waitForURL(/journal/, { timeout: 20000 });
    await p.waitForTimeout(3500);
    log('journal url:', decodeURIComponent(p.url()));
    await shot(p, 's3-10-journal-from-waitlist');
    const dlg = p.locator('[role=dialog]').last();
    log('booking window has name:', await dlg.getByText('QA Интервал').count(), 'phone input:', await dlg.locator('input[value*="000"]').count());
  });
  // ── Ресурс
  await step('resource create', async () => {
    await goto(p, '/biz/resources/new');
    await p.locator('main input').first().fill('QA Кресло');
    await shot(p, 's3-11-res-new', true);
    await p.locator('main').getByRole('button', { name: 'Сохранить' }).last().click();
    await p.waitForTimeout(2500);
    log('after create url', p.url());
    await shot(p, 's3-12-res-created', true);
    await goto(p, '/biz/resources');
    log('list has QA Кресло:', await p.getByText('QA Кресло').count());
  });
  log('errors:', p.errors);
} finally { await stop(); }
