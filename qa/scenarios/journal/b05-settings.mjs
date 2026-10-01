// b05-m0: настройки журнала (F-01-155, 167-177) — сохранение и переживание перезагрузки; чат F-01-165/166.
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
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // F-01-167: тип записи → "Индивидуальная"
  await page.getByText('Индивидуальная запись', { exact: false }).click();
  // F-01-171: первая строка → "Номер телефона"
  await page.getByRole('radio', { name: 'Номер телефона' }).click();
  // F-01-172: интервал → "Каждая запись — отдельный визит"
  await page.getByRole('radio', { name: /Каждая запись.*отдельный визит/ }).click();
  // F-01-176: показывать отчество
  const patronymicSwitch = page.getByRole('switch', { name: 'Показывать поле Отчество' });
  await patronymicSwitch.click();
  // F-01-169
  const occupiedSwitch = page.getByRole('switch', { name: /занятые ресурсы/i });
  await occupiedSwitch.click();

  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Сохранить' }).first().click();
  await page.waitForTimeout(1200);
  const toastVisible = await page.locator('text=/Настройки сохранены|сохранены/i').first().count();
  log('F-01-168: тост об успешном сохранении показан', toastVisible > 0, toastVisible);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const individualSelected = await page.locator('button:has-text("Индивидуальная запись")').first().evaluate((el) => el.className.includes('border-primary'));
  log('F-01-167: тип записи "Индивидуальная" пережил перезагрузку', individualSelected);
  const phoneFirstLine = await page.getByRole('radio', { name: 'Номер телефона' }).isChecked();
  log('F-01-171: первая строка "Номер телефона" пережила перезагрузку', phoneFirstLine);
  const perBookingChecked = await page.getByRole('radio', { name: /Каждая запись.*отдельный визит/ }).isChecked();
  log('F-01-172: "каждая запись — отдельный визит" пережило перезагрузку', perBookingChecked);
  const patronymicChecked = (await patronymicSwitch.getAttribute('aria-checked')) === 'true';
  log('F-01-176: "показывать отчество" пережило перезагрузку', patronymicChecked);
  const occupiedChecked = (await occupiedSwitch.getAttribute('aria-checked')) === 'true';
  log('F-01-169: "занятые ресурсы" пережило перезагрузку', occupiedChecked);

  // Проверить, что смена первой строки реально меняет журнал (F-01-171 "Готово когда")
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/shots/journal/b05-firstline-phone.png', fullPage: true });
  const phonePattern = await page.locator('[data-f*="F-01-128"]').first().textContent().catch(() => null);
  log('F-01-171: первая строка блока записи теперь похожа на телефон', /\+?\d[\d\s\-()]{5,}/.test(phonePattern ?? ''), phonePattern);

  // ═══ F-01-155: выключить лист ожидания → плитка пропадает из сайдбара ═══
  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const waitlistSwitch = page.getByRole('switch', { name: /лист ожидания/i }).first();
  const wlBefore = await waitlistSwitch.getAttribute('aria-checked');
  if (wlBefore === 'true') await waitlistSwitch.click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Сохранить' }).first().click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa/shots/journal/b05-waitlist-off.png', fullPage: true });
  const waitlistTile = await page.locator('text=Лист ожидания').count();
  log('F-01-155: выключенная настройка убирает плитку "Лист ожидания" из сайдбара', waitlistTile === 0, waitlistTile);

  // вернуть обратно
  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const wlSwitch2 = page.getByRole('switch', { name: /лист ожидания/i }).first();
  if ((await wlSwitch2.getAttribute('aria-checked')) === 'false') await wlSwitch2.click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Сохранить' }).first().click();
  await page.waitForTimeout(1000);

  // ═══ F-01-165/166: чат ═══
  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const connectBtn = page.getByRole('button', { name: /Подключить интеграцию/i });
  log('чат: кнопка "Подключить интеграцию (демо)" найдена', await connectBtn.count() > 0);
  await connectBtn.click();
  await page.waitForTimeout(300);
  const popupSwitch = page.getByRole('switch', { name: /веб-версии уведомление о сообщении/i });
  log('после подключения появился переключатель попапа (F-01-165)', await popupSwitch.count() > 0);
  if ((await popupSwitch.getAttribute('aria-checked')) === 'false') await popupSwitch.click();
  const autoSaveSwitch = page.getByRole('switch', { name: /Сохранять новых клиентов из чата/i });
  log('появился переключатель автосохранения лидов (F-01-166)', await autoSaveSwitch.count() > 0);
  if ((await autoSaveSwitch.getAttribute('aria-checked')) === 'false') { await autoSaveSwitch.click(); await page.waitForTimeout(800); }
  await page.waitForTimeout(500);
  const simulateBtn = page.getByRole('button', { name: /Новое сообщение в чате/i });
  await simulateBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa/shots/journal/b05-chat-popup.png', fullPage: true });
  const popupBanner = await page.locator('[role="status"]').filter({ hasText: /New client/i }).count();
  log('F-01-165: всплывашка о новом сообщении показана после "Симулировать"', popupBanner > 0, popupBanner);

  const chatLead = await page.evaluate(() => {
    const raw = localStorage.getItem('bp-mock-db');
    const db = JSON.parse(raw).state ?? JSON.parse(raw);
    const clients = db.core.clients ?? [];
    const leads = clients.filter((c) => (c.tags ?? []).some((t) => /лид из чата|chat.?lead/i.test(t)));
    return { total: clients.length, leadsFound: leads.length, sample: leads[0] };
  });
  log('F-01-166: клиент с категорией "Chat lead" появился в базе после симуляции', chatLead.leadsFound > 0, chatLead);

  out.consoleErrors = consoleErrors;
  await ctx.close();
} catch (e) {
  out.error = String(e);
  console.error(e);
} finally {
  await browser.close();
  release();
  fs.writeFileSync('qa/measure/journal/b05-settings-report.json', JSON.stringify(out, null, 2));
  console.log('done');
}
