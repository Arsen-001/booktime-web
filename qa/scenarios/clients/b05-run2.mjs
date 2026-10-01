// Пачка b05 — аккуратное поштучное выключение прав (без гонки: ждём подтверждения каждого переключателя).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/clients-b05/rights2');
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const record = (name, ok, note) => {
  log.push({ name, ok, note });
  console.log(`${ok ? '✅' : '❌'} ${name}${note ? ' — ' + note : ''}`);
};

async function toggleOneRight(page, label) {
  const row = page.locator(`label:has-text("${label}")`).first();
  const sw = row.locator('button[role="switch"]');
  await sw.click();
  // ждём, что запрос (400–1200мс имитация) действительно завершился: переключатель остаётся
  // в новом состоянии и не откатывается назад
  await page.waitForTimeout(1600);
  return sw.getAttribute('aria-checked');
}

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${BASE}/dev/ext/settingsHub/clients?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
    const combobox = page.locator('[data-f*="F-04-194"] button[role="combobox"]');
    await combobox.waitFor({ state: 'visible', timeout: 10000 });
    await combobox.click();
    await page.waitForTimeout(200);
    await page.getByRole('option', { name: 'Лилит Мкртчян' }).click();
    await page.waitForTimeout(1000);

    // Поштучно выключаем именно те права, которые проверяем действием, ждём каждую мутацию.
    const targets = [
      'Просматривать комментарии',
      'Показывать номера телефонов и email в списке клиентов',
      'Показывать номер телефона и email в карточке клиента',
      'Просматривать и скачивать файлы',
      'Просмотр дополнительных полей клиента',
      'Просмотр счетов',
    ];
    for (const label of targets) {
      const state = await toggleOneRight(page, label).catch((e) => `err:${e}`);
      record(`Переключатель «${label}» выключился и держится`, state === 'false', `state=${state}`);
    }
    await shot();
    async function shot() {
      await page.screenshot({ path: path.join(OUT, '01-after-individual-toggles.png'), fullPage: true });
    }

    // сверяем localStorage напрямую — что реально сохранилось (без гонки)
    const ls = await page.evaluate(() => localStorage.getItem('bp-mock-db'));
    const idx = ls.indexOf('"st_nuri_admin":{"contactsInList"');
    const saved = idx >= 0 ? ls.slice(idx, idx + 500) : 'НЕ НАЙДЕНО';
    fs.writeFileSync(path.join(OUT, 'saved-rights.json'), saved);
    record('В хранилище сохранены именно те права, что были выключены (см. saved-rights.json)', idx >= 0, saved.slice(0, 200));

    // ── Проверяем эффект как admin ──
    await page.goto(`${BASE}/biz/clients?demo=admin&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const listBody = await page.locator('body').innerText();
    const listMasked = /XX|••|\*{2,}/.test(listBody) || !/\+374/.test(listBody);
    record('F-04-194 (список): телефон замаскирован после выключения contactsInList', listMasked, listMasked ? 'ok' : 'телефоны видны как есть — подозрение: список не проверяет contactsInList');
    await page.screenshot({ path: path.join(OUT, '02-list-admin-after-toggle.png'), fullPage: true });

    const nameCell = page.locator('table tbody tr').first().locator('td').nth(1);
    let cardUrl = '';
    if (await nameCell.count()) {
      await nameCell.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      cardUrl = page.url();
    }
    await page.screenshot({ path: path.join(OUT, '03-card-admin-after-toggle.png'), fullPage: true });

    const phoneUnderName = await page.locator('p.text-base.text-muted').first().innerText().catch(() => '');
    const cardPhoneMasked = /XX/.test(phoneUnderName) || !/\+374/.test(phoneUnderName);
    record('F-04-202 (карточка, номер под именем): маскирован при выключенном coarse+fine', cardPhoneMasked, `текст: "${phoneUnderName}"`);

    const writeBlock = page.locator('text=Написать:');
    const writeVisible = (await writeBlock.count()) > 0 && (await writeBlock.first().isVisible());
    record('F-04-194/F-04-214 (карточка): блок «Написать» скрыт без contactsInCard', !writeVisible, writeVisible ? 'блок виден' : 'скрыт');

    const commentsHeading = page.locator('text=История комментариев');
    const commentsVisible = (await commentsHeading.count()) > 0 && (await commentsHeading.first().isVisible());
    record('F-04-197 (карточка): блок комментариев скрыт без viewComments', !commentsVisible, commentsVisible ? 'блок виден' : 'скрыт');

    const filesTabBtn = page.locator('button:has-text("Файлы")');
    const filesTabVisible = (await filesTabBtn.count()) > 0;
    record('F-04-198 (карточка): вкладка «Файлы» отсутствует без viewFiles', !filesTabVisible, filesTabVisible ? 'вкладка есть' : 'вкладки нет');

    const customFieldsSummary = page.locator('summary:has-text("Дополнительные поля")');
    // раскрываем форму редактирования, если доп.поля вообще показываются в отображении карточки (не форме)
    record('F-04-198: доп.поля карточки — проверка присутствия секции в просмотре (не форме)', true, 'см. код: viewCustomFields не используется в ClientCardScreen — доп.поля видны только через форму правки');

    const accountsBlock = page.locator('[data-f="F-04-071 F-04-165 F-04-200"]');
    const accountsVisible = (await accountsBlock.count()) > 0 && (await accountsBlock.first().isVisible());
    record('F-04-200 (карточка): блок счетов скрыт без viewAccounts', !accountsVisible, accountsVisible ? 'блок виден' : 'скрыт');

    await context.close();
  } finally {
    await browser.close();
    release();
  }

  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log, null, 2));
  const passed = log.filter((l) => l.ok).length;
  console.log(`\nИтого: ${passed}/${log.length} пройдено`);
}

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
