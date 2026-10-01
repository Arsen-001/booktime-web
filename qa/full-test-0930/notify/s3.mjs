import { withBrowser, newPage, go, text, shot, BASE } from './lib.mjs';
const log = (...a) => console.log(...a);
await withBrowser(async (b) => {
  const p = await newPage(b);
  // 1. toggle type 1 off in list → reload → persisted → back on
  await go(p, '/biz/notifications', 3000);
  const sw = p.getByRole('switch', { name: /Напоминание о визите/ }).first();
  log('T1 switch before', await sw.getAttribute('aria-checked'), await sw.getAttribute('data-state'));
  await sw.click(); await p.waitForTimeout(1500);
  log('toast', (await p.locator('[role=status], [data-sonner-toast], [role=alert]').allInnerTexts()).join(' / ').slice(0, 200));
  await shot(p, 'a1-toggle');
  await go(p, '/biz/notifications', 3000);
  const sw2 = p.getByRole('switch', { name: /Напоминание о визите/ }).first();
  log('T1 switch after reload', await sw2.getAttribute('aria-checked'));
  await sw2.click(); await p.waitForTimeout(1500);
  await go(p, '/biz/notifications', 3000);
  log('T1 switch restored', await p.getByRole('switch', { name: /Напоминание о визите/ }).first().getAttribute('aria-checked'));

  // 2. type 1: telegram scenario
  await go(p, '/biz/notifications/types/1', 3000);
  const tgRow = p.locator('li', { hasText: 'Telegram' }).first();
  log('TG row:', (await tgRow.innerText()).replace(/\n/g, ' | '));
  const tgSel = tgRow.getByRole('combobox');
  if (await tgSel.count()) {
    await tgSel.click(); await p.waitForTimeout(500);
    await p.getByRole('option', { name: 'Не отправлять' }).click(); await p.waitForTimeout(1500);
    await go(p, '/biz/notifications/types/1', 3000);
    log('TG after reload:', (await p.locator('li', { hasText: 'Telegram' }).first().innerText()).replace(/\n/g, ' | '));
    log('preview:', (await p.locator('section, div', { hasText: 'Что уйдёт клиенту' }).last().innerText()).replace(/\n/g, ' | ').slice(0, 300));
    await p.locator('li', { hasText: 'Telegram' }).first().getByRole('combobox').click(); await p.waitForTimeout(400);
    await p.getByRole('option', { name: 'Всегда отправлять' }).click(); await p.waitForTimeout(1500);
  } else {
    const btn = tgRow.getByRole('button');
    log('TG row has button:', await btn.allInnerTexts());
    if (await btn.count()) { await btn.first().click(); await p.waitForTimeout(2500); log('TG connect →', p.url()); await shot(p, 'a2-tg-connect'); log((await text(p)).slice(0, 600).replace(/\n+/g,' | ')); }
  }
  // 3. templates: edit push text
  await go(p, '/biz/notifications/types/1/templates', 3500);
  await shot(p, 'a3-templates');
  const acc = await p.locator('button[aria-expanded]').allInnerTexts();
  log('accordion:', acc.join(' / '));
  const ta = p.locator('textarea').first();
  if (await ta.count()) {
    const before = await ta.inputValue();
    await ta.fill(before + ' QA0930');
    const save = p.getByRole('button', { name: 'Сохранить' }).first();
    log('save enabled', await save.isEnabled());
    await save.click(); await p.waitForTimeout(1500);
    await go(p, '/biz/notifications/types/1/templates', 3500);
    const after = await p.locator('textarea').first().inputValue();
    log('template persisted:', after.includes('QA0930'));
    await p.locator('textarea').first().fill(before);
    await p.getByRole('button', { name: 'Сохранить' }).first().click(); await p.waitForTimeout(1500);
  }
  // telegram template accordion
  const tgAcc = p.locator('button[aria-expanded]', { hasText: 'Telegram' });
  if (await tgAcc.count()) { await tgAcc.first().click(); await p.waitForTimeout(600); await shot(p, 'a3-tg-template'); log('TG template area:', (await tgAcc.first().locator('xpath=../..').innerText()).slice(0, 300).replace(/\n/g,' | ')); }
  // 4. log: channel filter Telegram
  await go(p, '/biz/notifications/log', 4000);
  const body = await text(p);
  log('LOG telegram mentions:', (body.match(/Telegram/g) || []).length, 'rows sample:', body.slice(0, 900).replace(/\n+/g, ' | '));
  // open first row
  const row = p.locator('tbody tr').first();
  if (await row.count()) { await row.click(); await p.waitForTimeout(1000); await shot(p, 'a4-log-modal'); log('MODAL', (await p.locator('[role=dialog]').innerText().catch(()=>'')).slice(0, 500).replace(/\n+/g,' | ')); await p.keyboard.press('Escape'); }
  // CSV
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.getByRole('button', { name: /Выгрузить|Скачать|CSV|Excel/ }).first().click().catch(() => {})]);
  log('CSV download:', dl ? dl.suggestedFilename() : 'none');
  log('ERRORS', JSON.stringify(p.errors));
});
