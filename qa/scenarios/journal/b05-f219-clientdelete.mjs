// F-01-219: последствия удаления карточки клиента для его записей в журнале/отчёте «Записи».
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3710';
const out = { steps: [] };
const log = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); console.log((ok ? '✅' : '❌'), name, detail ?? ''); };

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const raw = localStorage.getItem('bp-mock-db');
    const db = JSON.parse(raw).state ?? JSON.parse(raw);
    const bookings = (db.core.bookings ?? []).filter((b) => !b.deletedAt && b.businessId === 'biz_nuri');
    const withClient = bookings.find((b) => b.clientId);
    return withClient ? { bookingId: withClient.id, clientId: withClient.clientId, date: withClient.start?.slice(0, 10) } : null;
  });
  log('нашли запись с клиентом в моковой базе', !!info, info);
  if (!info) throw new Error('no booking with client found');

  const clientName = await page.evaluate((clientId) => {
    const raw = localStorage.getItem('bp-mock-db');
    const db = JSON.parse(raw).state ?? JSON.parse(raw);
    return db.core.clients.find((c) => c.id === clientId)?.name;
  }, info.clientId);
  log('имя клиента до удаления', !!clientName, clientName);

  // Открыть карточку клиента и удалить
  await page.goto(`${BASE}/biz/clients/${info.clientId}?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa/shots/journal/b05-f219-before-delete.png', fullPage: true });
  const deleteBtn = page.getByRole('button', { name: /^Удалить$/i }).first();
  log('кнопка "Удалить" на карточке клиента найдена', await deleteBtn.count() > 0);
  if (await deleteBtn.count()) {
    await deleteBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'qa/shots/journal/b05-f219-confirm.png', fullPage: true });
    const confirmBtn = page.getByRole('button', { name: /Удалить/i }).last();
    await confirmBtn.click();
    await page.waitForTimeout(1200);
  }

  // Проверить, что запись осталась в отчёте "Записи"
  await page.goto(`${BASE}/biz/records?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const stillThere = await page.evaluate((bookingId) => {
    const raw = localStorage.getItem('bp-mock-db');
    const db = JSON.parse(raw).state ?? JSON.parse(raw);
    const b = db.core.bookings.find((x) => x.id === bookingId);
    return b ? { exists: true, deletedAt: b.deletedAt ?? null, status: b.status } : { exists: false };
  }, info.bookingId);
  log('F-01-219: запись клиента осталась в журнале/базе после удаления карточки (не стёрлась)', stillThere.exists && !stillThere.deletedAt, stillThere);

  const rowVisible = await page.locator(`text=${clientName}`).count();
  log('F-01-219: имя удалённого клиента всё ещё видно в отчёте «Записи»', rowVisible > 0, rowVisible);
  await page.screenshot({ path: 'qa/shots/journal/b05-f219-records-after.png', fullPage: true });

  // Открыть окно этой записи — "Всего визитов 0"?
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&date=${info.date}&booking=${info.bookingId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    await page.screenshot({ path: 'qa/shots/journal/b05-f219-booking-window.png', fullPage: true });
    const headerName = await dialog.locator('p, span').first().textContent().catch(() => null);
    log('заголовок окна записи (ожидаем имя удалённого клиента)', true, headerName);
    const clientTab = dialog.getByRole('tab', { name: 'Клиент' });
    if (await clientTab.count()) { await clientTab.click({ force: true }); await page.waitForTimeout(1200); }
    await page.screenshot({ path: 'qa/shots/journal/b05-f219-booking-window-client.png', fullPage: true });
    const visitsZero = await dialog.locator('text=/Визитов/i').locator('xpath=..').textContent().catch(() => null);
    log('окно записи удалённого клиента — блок "Визитов" виден', true, visitsZero);
  } else {
    log('окно записи не открылось после удаления клиента (?booking=)', false);
  }

  await ctx.close();
} catch (e) {
  out.error = String(e);
  console.error(e);
} finally {
  await browser.close();
  release();
  fs.writeFileSync('qa/measure/journal/b05-f219-report.json', JSON.stringify(out, null, 2));
  console.log('done');
}
