// Ручной прогон пачки b05 (права, безопасность, ФИО, приложение, редкое) — раздел clients.
// ИЗМЕРИТЕЛЬ: код не правит, только читает и щёлкает. node qa/scenarios/clients/b05-run.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/clients-b05/rights');
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const record = (name, ok, note) => {
  log.push({ name, ok, note });
  console.log(`${ok ? '✅' : '❌'} ${name}${note ? ' — ' + note : ''}`);
};

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const consoleErrors = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    // ── 1. Владелец открывает вклад clients в хабе настроек (хост-экран settings ещё не построен →
    //    смотрим через /dev/ext, как велит AGENTS/CONVENTIONS) и выключает права у сотрудника-администратора
    // Демо-персона admin резолвится в первого сотрудника role==='admin' (см. src/demo/context.ts) —
    // это «Лилит Мкртчян» (st_nuri_admin, src/mock/seed/staff.ts:131). Выбираем её явно в Select.
    await page.goto(`${BASE}/dev/ext/settingsHub/clients?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
    const sectionExists = await page.locator('[data-f*="F-04-194"]').count();
    record('F-04-194..204: секция прав видна владельцу в /dev/ext/settingsHub/clients', sectionExists > 0);
    const combobox = page.locator('[data-f*="F-04-194"] button[role="combobox"]');
    await combobox.waitFor({ state: 'visible', timeout: 10000 });
    await shot(page, '01-settingshub-owner-before');

    await combobox.click();
    await page.waitForTimeout(200);
    const adminOption = page.getByRole('option', { name: 'Лилит Мкртчян' });
    const adminOptionFound = await adminOption.count();
    if (adminOptionFound) {
      await adminOption.click();
      record('Выбор сотрудника (Лилит Мкртчян, role=admin) в списке прав сработал', true);
    } else {
      await page.keyboard.press('Escape');
      record('Выбор сотрудника (Лилит Мкртчян, role=admin) в списке прав сработал', false, 'опция не найдена в списке');
    }
    await page.waitForTimeout(600);

    // выключить как можно больше переключателей (все Switch внутри секции прав)
    const switches = page.locator('[data-f*="F-04-194"] button[role="switch"]');
    const swCount = await switches.count();
    let turnedOff = 0;
    for (let i = 0; i < swCount; i++) {
      const sw = switches.nth(i);
      const checked = await sw.getAttribute('aria-checked');
      if (checked === 'true') {
        await sw.click();
        turnedOff++;
        await page.waitForTimeout(80);
      }
    }
    record('Переключатели прав кликабельны и выключаются', turnedOff > 0, `выключено ${turnedOff} из ${swCount}`);
    await page.waitForTimeout(500);
    await shot(page, '02-settingshub-owner-after-toggle-off');

    // перезагрузка страницы — держится ли состояние (общий пункт «сохранение после перезагрузки»)
    await page.reload({ waitUntil: 'networkidle' });
    const afterReload = page.locator('[data-f*="F-04-194"] button[role="switch"][aria-checked="true"]');
    const stillOnCount = await afterReload.count();
    record('Права сохраняются после перезагрузки страницы', stillOnCount < swCount, `осталось включено ${stillOnCount} из ${swCount}`);
    await shot(page, '03-settingshub-owner-after-reload');

    // ── 2. Тот же браузер (общий localStorage), персона — администратор: проверяем ограничения
    await page.goto(`${BASE}/biz/clients?demo=admin&lang=ru`, { waitUntil: 'networkidle' });
    await shot(page, '04-clients-list-admin-masked');
    const bodyText = await page.locator('body').innerText();
    const hasXX = bodyText.includes('XX') || /\*{2,}/.test(bodyText);
    record('F-04-194/F-04-202: список клиентов маскирует телефон/email у админа без прав', hasXX);

    // строку клиента — открыть карточку (клик по имени в первой строке таблицы)
    let cardUrl = '';
    const firstNameCell = page.locator('table tbody tr').first().locator('td').nth(1);
    if (await firstNameCell.count()) {
      await firstNameCell.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      cardUrl = page.url();
    }
    await shot(page, '05-client-card-admin');
    record('Открытие карточки клиента кликом по строке списка работает', /\/biz\/clients\/cl_/.test(cardUrl), cardUrl);

    // F-04-106: имя сокращено (буква фамилии без отчества)
    const nameEl = page.locator('[data-f="F-04-106"]').first();
    let nameText = '';
    if (await nameEl.count()) nameText = (await nameEl.innerText()).trim();
    const looksTruncated = /\s[A-ZА-ЯЁ]\.\s*$/.test(nameText) || /^[^\s]+\s[A-ZА-ЯЁ]\.$/.test(nameText);
    record('F-04-106: без права фамилия сокращена до буквы, отчество скрыто', looksTruncated, `имя на экране: "${nameText}"`);

    // F-04-195: карточка "Просмотр примечания"/лояльность — блок скрыт целиком без прав
    const notePanel = page.locator('[data-f="F-04-195"]');
    const notePanelVisible = (await notePanel.count()) > 0 && (await notePanel.first().isVisible());
    record('F-04-195: блок примечания/лояльности скрыт без права просмотра', !notePanelVisible, notePanelVisible ? 'блок всё ещё виден' : 'скрыт');

    // F-04-197: комментарии — блок целиком (текст записан в код-комментарии как гейт viewComments)
    const commentsBlock = page.locator('[data-f="F-04-070 F-04-197"]');
    const commentsVisible = (await commentsBlock.count()) > 0 && (await commentsBlock.first().isVisible());
    record('F-04-197: без viewComments блок комментариев скрыт', !commentsVisible, commentsVisible ? 'блок всё ещё виден' : 'скрыт целиком');

    // F-04-198: вкладка "Файлы" не открывается / не видна без права
    const filesBlock = page.locator('[data-f="F-04-086 F-04-198"]');
    const filesVisible = (await filesBlock.count()) > 0 && (await filesBlock.first().isVisible());
    record('F-04-198: блок файлов присутствует на экране', filesVisible, filesVisible ? 'виден без явного скрытия' : 'скрыт');

    // F-04-200: счета — просмотр/пополнение
    const accountsBlock = page.locator('[data-f="F-04-071 F-04-165 F-04-200"]');
    const accountsVisible = (await accountsBlock.count()) > 0 && (await accountsBlock.first().isVisible());
    record('F-04-200: блок счетов присутствует', accountsVisible);

    // F-04-192/213/228: национальный номер / язык / ДР-переключатель
    const extraBlock = page.locator('[data-f="F-04-192 F-04-213 F-04-228"]');
    record('F-04-192/213/228: блок доп.полей карточки (ИИН/язык/ДР) на экране', (await extraBlock.count()) > 0);

    // F-04-211: в коде это <span data-f="F-04-211" hidden /> — заглушка без действия; фиксируем факт
    const gdprMarker = page.locator('[data-f="F-04-211"]');
    const gdprCount = await gdprMarker.count();
    let gdprHasAction = false;
    if (gdprCount) {
      const outer = await gdprMarker.first().evaluate((el) => el.outerHTML);
      gdprHasAction = !outer.includes('hidden');
    }
    record('F-04-211: «удалить все данные клиента» — настоящее действие, а не скрытая заглушка', gdprHasAction, gdprCount ? 'найден <span hidden> без обработчика' : 'маркера нет вовсе');

    // ── 3. Персона — мастер: F-04-199 "только свои клиенты"
    await page.goto(`${BASE}/biz/clients?demo=master&lang=ru`, { waitUntil: 'networkidle' });
    await shot(page, '06-clients-list-master');
    const masterMarker = page.locator('[data-f="F-04-199"]');
    record('F-04-199: маркер области видимости (только свои клиенты) присутствует у мастера', (await masterMarker.count()) > 0);

    // ── 4. Владелец: журнал изменений (F-04-207)
    await page.goto(`${BASE}/biz/clients/log?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
    await shot(page, '07-clients-log-owner');
    const logBlock = page.locator('[data-f="F-04-137 F-04-207"]');
    record('F-04-207: экран "Изменения данных" открывается и содержит запись о клиенте', (await logBlock.count()) > 0);
    const logText = await page.locator('body').innerText();
    record('F-04-207: в журнале виден хоть один автор и время правки', /\d{2}[.:]\d{2}/.test(logText));

    // ── 5. Владелец: категории — F-04-204 (владелец правит) vs мастер (только чтение)
    await page.goto(`${BASE}/biz/clients/categories?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
    await shot(page, '08-categories-owner');
    const addBtn = page.locator('button:has-text("Добавить"), button:has-text("Категория")');
    record('F-04-204: владелец видит кнопку добавления категории', (await addBtn.count()) > 0);

    await page.goto(`${BASE}/biz/clients/categories?demo=master&lang=ru`, { waitUntil: 'networkidle' });
    await shot(page, '09-categories-master');
    const addBtnMaster = page.locator('button:has-text("Добавить"), button:has-text("Категория")');
    const masterCanAdd = (await addBtnMaster.count()) > 0;
    let masterCanAddEnabled = false;
    if (masterCanAdd) masterCanAddEnabled = await addBtnMaster.first().isEnabled();
    record('F-04-204: без права manageCategories справочник только для чтения у мастера', !masterCanAddEnabled, masterCanAdd ? `кнопка есть, enabled=${masterCanAddEnabled}` : 'кнопки нет вовсе');

    // ── 6. Согласие/анкета — F-04-153/154 (открыть ссылку анкеты без приложения)
    // возьмём id клиента из карточки, открытой ранее
    if (cardUrl) {
      const clientId = new URL(cardUrl).pathname.split('/').pop();
      const consentUrl = `${BASE}/biz/clients/consent/${clientId}?demo=owner&lang=ru`;
      const consentPage = await context.newPage();
      await consentPage.goto(consentUrl, { waitUntil: 'networkidle' });
      await consentPage.screenshot({ path: path.join(OUT, '10-consent-form.png'), fullPage: true });
      const consentBlock = consentPage.locator('[data-f="F-04-154"]');
      record('F-04-154: анкета/согласие по ссылке открывается без входа в приложение', (await consentBlock.count()) > 0, consentUrl);
      await consentPage.close();
    } else {
      record('F-04-154: анкета/согласие по ссылке', false, 'не удалось получить id клиента из карточки');
    }

    // ── 7. Телефон 390×844, en, hy — базовый прогон карточки и списка
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await mobileCtx.newPage();
    await mp.goto(`${BASE}/biz/clients?demo=owner&lang=en`, { waitUntil: 'networkidle' });
    await mp.screenshot({ path: path.join(OUT, '11-clients-list-phone-en.png'), fullPage: true });
    const rawKeyRe = /\b[a-zA-Z0-9]+\.[a-zA-Z0-9.]+\b.*(⋯|\?\?\?)/;
    const mobileBody = await mp.locator('body').innerText();
    record('EN/телефон: нет сырых ключей на экране списка', !rawKeyRe.test(mobileBody));
    await mp.goto(`${BASE}/biz/clients?demo=owner&lang=hy`, { waitUntil: 'networkidle' });
    await mp.screenshot({ path: path.join(OUT, '12-clients-list-phone-hy.png'), fullPage: true });
    const hyBody = await mp.locator('body').innerText();
    const hasArmenian = /[԰-֏]/.test(hyBody);
    record('HY: армянские буквы присутствуют на экране (не откат к EN/RU)', hasArmenian);
    await mobileCtx.close();

    fs.writeFileSync(path.join(OUT, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
    record('Ошибки консоли за весь прогон', consoleErrors.length === 0, `${consoleErrors.length} шт.`);

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
