// b05-m2 measurement probe: checks remaining "Готово, когда" points for F-01-169..176, F-01-085, F-01-219
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3710';
const OUT = path.resolve('qa/shots/journal/b05-m2');
fs.mkdirSync(OUT, { recursive: true });
const steps = [];
function log(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(ok ? '✅' : '❌', name, detail ?? '');
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
  const page = await ctx.newPage();

  // --- F-01-170: defaultView радио меняет то, что открывается по умолчанию ---
  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.locator('[data-f="F-01-170"]').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const resourceRadio = page.locator('[data-f="F-01-170"] label:has-text("ресурс")').first();
  const hasResourceOption = await resourceRadio.count();
  log('F-01-170: радио "по ресурсам" найдено', hasResourceOption > 0);
  if (hasResourceOption) {
    await resourceRadio.click();
    const saveBtn = page.getByRole('button', { name: /Сохранить/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(600);
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'f170-journal-after-resource-default.png') });
    // ищем индикатор режима "по ресурсам" в тулбаре (переключатель staff/resource активен на resource)
    const resourceActive = await page.locator('button[aria-pressed="true"]:has-text("сурс"), button[data-active="true"]:has-text("сурс")').count();
    log('F-01-170: после reload журнал открылся в виде "по ресурсам"', resourceActive > 0, `resourceActiveCount=${resourceActive}`);
    // возвращаем обратно на staff, чтобы не портить состояние другим замерам
    await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.locator('[data-f="F-01-170"] label:has-text("сотрудник")').first().click();
    await page.getByRole('button', { name: /Сохранить/i }).first().click();
    await page.waitForTimeout(500);
  }

  // --- F-01-169: занятые ресурсы видны у сотрудника ---
  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  const occSwitch = page.locator('[data-f="F-01-169"] button[role="switch"]').first();
  const occCount = await occSwitch.count();
  log('F-01-169: переключатель найден', occCount > 0);
  if (occCount) {
    const wasOn = (await occSwitch.getAttribute('aria-checked')) === 'true';
    if (!wasOn) {
      await occSwitch.click();
      await page.getByRole('button', { name: /Сохранить/i }).first().click();
      await page.waitForTimeout(500);
    }
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'f169-journal-occupied-resources-on.png'), fullPage: false });
  }

  // --- F-01-172: склейка визита при разрыве < N мин ---
  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.locator('[data-f="F-01-172"]').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const groupingSelect = page.locator('[data-f="F-01-172"] select, [data-f="F-01-172"] [role="combobox"]').first();
  log('F-01-172: контрол разрыва найден', (await groupingSelect.count()) > 0);
  await page.screenshot({ path: path.join(OUT, 'f172-visit-grouping-control.png') });

  // --- F-01-174: разделение записи по ресурсам (toolbar toggle) ---
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const splitToggle = page.locator('text=/[Дд]елить запись по ресурсам/').first();
  const splitCount = await splitToggle.count();
  log('F-01-174: переключатель "По ресурсам" в тулбаре журнала найден', splitCount > 0);
  if (splitCount) {
    await splitToggle.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'f174-split-by-resource-on.png') });
  }

  // --- F-01-175: технический перерыв — правило видно в шапке ---
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  const breakControl = page.locator('text=/[Пп]ерерыв/').first();
  log('F-01-175: индикатор перерыва в журнале найден', (await breakControl.count()) > 0);

  // --- F-01-173: "Не пришёл" освобождает слот ---
  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  const noShowSwitch = page.locator('[data-f="F-01-173"] button[role="switch"]').first();
  log('F-01-173: переключатель "разрешить поверх Не пришёл" найден', (await noShowSwitch.count()) > 0);

  // --- F-01-176: своя зона (журнал) — только ссылка-делегат на настройки клиентов; отчество своё ---
  const elsewhereLink = page.locator('[data-f="F-01-176"] a[href="/biz/settings"]').first();
  log('F-01-176: ссылка-делегат на /biz/settings присутствует', (await elsewhereLink.count()) > 0);
  const patronymicSwitch = page.locator('[data-f="F-01-176"] button[role="switch"]').first();
  log('F-01-176: переключатель "Отчество" найден', (await patronymicSwitch.count()) > 0);

  // --- F-01-085: без права редактирования оплаченной "Пришёл" нельзя сохранить ---
  // Ищем в demo персоне master запись со статусом "Пришёл"+оплата, пробуем открыть и изменить поле
  await page.goto(`${BASE}/biz/journal?demo=master&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const arrivedChips = page.locator('[data-status="arrived"], [data-f*="F-01-078"]');
  log('F-01-085: искал записи "Пришёл" в журнале master (только разведка, не финальная проверка)', true, `count=${await arrivedChips.count()}`);

  // --- F-01-219: клиент удалён — записи остаются (только чтение localStorage, без удаления) ---
  const deletedClientProbe = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('booking-mock-db');
      if (!raw) return { found: 'no-db-key' };
      const db = JSON.parse(raw);
      const clients = db?.state?.core?.clients ?? db?.core?.clients ?? [];
      const deleted = Array.isArray(clients) ? clients.filter((c) => c.deletedAt) : [];
      return { totalClients: Array.isArray(clients) ? clients.length : 'n/a', deletedCount: deleted.length };
    } catch (e) {
      return { error: String(e) };
    }
  });
  log('F-01-219: разведка localStorage на предмет уже удалённых клиентов', true, JSON.stringify(deletedClientProbe));

  await ctx.close();
} finally {
  await browser.close();
  release();
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ steps }, null, 2));
console.log('DONE', OUT);
