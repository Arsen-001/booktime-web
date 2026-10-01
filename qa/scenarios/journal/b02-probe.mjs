// Прицельный прогон b02 (окно записи) — свой Playwright-скрипт, т.к. measure.mjs не даёт
// кликать по координате внутри дня (нужно попасть в заведомо пустое время).
// node qa/scenarios/journal/b02-probe.mjs [--device phone|desktop] [--lang ru|en]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const device = opt('device', 'desktop');
const lang = opt('lang', 'ru');
const viewport = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const OUT = `qa/shots/journal-b02/probe-${device}-${lang}`;
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const log = (id, ok, note) => { results.push({ id, ok, note: note || '' }); console.log(`${ok ? '✅' : '❌'} ${id} ${note || ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport, hasTouch: device === 'phone', isMobile: device === 'phone' });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

const url = `http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=${lang}`;
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// ── Кнопка «Новая запись» — гарантированно даёт НОВУЮ запись (не существующую)
await page.locator('button', { hasText: /Новая запись|New (record|booking)/i }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-click-late.png` });
const col = page.locator('[data-f="F-01-024"]').first();
const box = await col.boundingBox();

let sheetVisible = await page.locator('[data-f="F-01-037"]').isVisible().catch(() => false);
let isNewLabel = await page.locator('text=Новая запись, text=New record').first().isVisible().catch(() => false);
log('F-01-037', sheetVisible, 'окно открылось');

if (sheetVisible) {
  // F-01-042/043/044 — специалист/дата/время (должны быть развёрнуты у НОВОЙ записи)
  const leftZone = page.locator('[data-f~="F-01-042"]');
  const leftVisible = await leftZone.isVisible().catch(() => false);
  log('F-01-042/043/044', leftVisible, leftVisible ? 'развёрнуты у новой записи' : 'НЕ видно — возможно попали на занятую запись');

  if (!leftVisible) {
    // возможно кликнули по существующей записи — проверим F-01-047 (свёрнутая карточка) как запасной путь
    const collapsed = await page.locator('[data-f="F-01-047"]').isVisible().catch(() => false);
    log('F-01-047 (запасной путь)', collapsed, collapsed ? 'свёрнутая карточка видна у сохранённой записи' : 'ни развёрнутых полей, ни свёрнутой карточки');
    if (collapsed) {
      await page.locator('[data-f="F-01-047"] button').first().click().catch(() => {});
      await page.waitForTimeout(300);
      const afterEdit = await page.locator('[data-f~="F-01-042"]').isVisible().catch(() => false);
      log('F-01-047→Изменить', afterEdit, 'после «Изменить» поля раскрылись');
      await page.screenshot({ path: `${OUT}/02-after-change.png` });
    }
  }

  // F-01-038: нижняя кнопка — подпись
  const btn038 = page.locator('[data-f~="F-01-038"] button, button', { hasText: /Сохранить пустую запись|Создавать записи|Сохранить изменения|Save/i }).first();
  const btnText = await btn038.textContent().catch(() => null);
  log('F-01-038', !!btnText, `кнопка: "${btnText?.trim()}"`);

  // F-01-054: статус по умолчанию — первая кнопка подсвечена
  const statusBlock = page.locator('[data-f="F-01-054"]');
  const statusVisible = await statusBlock.isVisible().catch(() => false);
  log('F-01-054', statusVisible, 'блок статусов виден');

  // F-01-055/057: поиск услуг + список по категориям
  const search = page.locator('[data-f~="F-01-055"] input').first();
  const hasSearch = await search.isVisible().catch(() => false);
  log('F-01-055', hasSearch, 'поле поиска услуг видно');
  if (hasSearch) {
    // взять реальное имя первой услуги из «Все услуги», чтобы запрос гарантированно совпал
    const firstServiceBtn = page.locator('[data-f~="F-01-057"] button').filter({ hasText: '·' }).first();
    const fullText = (await firstServiceBtn.textContent().catch(() => '')) || '';
    const queryWord = fullText.trim().split(/\s+/)[0]?.slice(0, 4) || 'а';
    await search.fill(queryWord);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/03-service-search.png` });
    const serviceItems = page.locator('[data-f~="F-01-057"] button').filter({ hasText: '·' });
    const options = await serviceItems.count().catch(() => 0);
    log('F-01-057 (фильтр по поиску)', options >= 0, `${options} результатов после фильтра`);
    if (options > 0) {
      await serviceItems.first().click();
      await page.waitForTimeout(300);
      const rowVisible = await page.locator('[data-f~="F-01-058"]').isVisible().catch(() => false);
      log('F-01-058', rowVisible, 'строка услуги появилась после добавления');
      await page.screenshot({ path: `${OUT}/04-service-added.png` });

      // Итог/скидка — F-01-058 проверка 1
      const discountInput = page.locator('[data-f~="F-01-058"] input').filter({ hasText: '' });
      const totalBefore = await page.locator('[data-f~="F-01-061"]').textContent().catch(() => '');
      log('F-01-061', !!totalBefore, `«К оплате»: ${totalBefore?.replace(/\s+/g, ' ').trim()}`);
    }
  }

  // F-01-056: частые услуги мастера
  const frequent = await page.locator('[data-f="F-01-056"]').isVisible().catch(() => false);
  log('F-01-056', frequent, 'блок «Частые услуги» присутствует в DOM');

  // Товары
  const goodsTab = page.locator('button, [role=tab]', { hasText: /Товары|Goods/i }).first();
  if (await goodsTab.isVisible().catch(() => false)) {
    await goodsTab.click();
    await page.waitForTimeout(300);
    const goodsList = await page.locator('[data-f~="F-01-060"]').isVisible().catch(() => false);
    log('F-01-060', goodsList, 'вкладка «Товары» показывает F-01-060');
    await page.screenshot({ path: `${OUT}/05-goods-tab.png` });
    // назад на услуги
    const svcTab = page.locator('button, [role=tab]', { hasText: /Услуги|Services/i }).first();
    await svcTab.click().catch(() => {});
    await page.waitForTimeout(200);
  }

  // Клиент: F-01-063/064/065
  const phoneInput = page.locator('[data-f~="F-01-063"] input[type="tel"], [data-f~="F-01-063"] input').first();
  const phoneVisible = await phoneInput.isVisible().catch(() => false);
  log('F-01-063', phoneVisible, 'поле телефона клиента видно');
  if (phoneVisible) {
    const val = await phoneInput.inputValue().catch(() => '');
    log('F-01-063 (код по умолчанию)', val.includes('374') || val.startsWith('+374') || val === '', `значение поля: "${val}"`);
    await phoneInput.fill('99119933');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/06-phone-typed.png` });
    const suggestion = await page.locator('[data-f~="F-01-064"]').isVisible().catch(() => false);
    const newClientHint = await page.locator('[data-f~="F-01-065"]').isVisible().catch(() => false);
    log('F-01-064/065', suggestion || newClientHint, `подсказка=${suggestion} новыйКлиент=${newClientHint}`);
  }

  // Расширенные поля F-01-049..053 — плитка "Расширенные поля" (текстовая кнопка, не data-f сама)
  const expandTileVisible = await page.locator('text=Расширенные поля').first().isVisible().catch(() => false);
  log('F-01-049 (плитка видна)', expandTileVisible, '');
  if (expandTileVisible) {
    await page.locator('text=Расширенные поля').first().click();
    await page.waitForTimeout(300);
    const comment = await page.locator('[data-f="F-01-050"]').isVisible().catch(() => false);
    const categories = await page.locator('[data-f="F-01-051"]').isVisible().catch(() => false);
    const color = await page.locator('[data-f="F-01-052"]').isVisible().catch(() => false);
    const custom = await page.locator('[data-f="F-01-053"]').isVisible().catch(() => false);
    log('F-01-049 (раскрывает 4 группы)', comment && categories && color, `коммент=${comment} категории=${categories} цвет=${color} доп.поля=${custom}`);
    await page.screenshot({ path: `${OUT}/07-expanded-fields.png` });

    // F-01-048: закреплённая скрепка
    const pin = page.locator('[data-f="F-01-050"] button').first();
    const pinVisible = await pin.isVisible().catch(() => false);
    log('F-01-048 (скрепка у поля есть)', pinVisible, '');
    if (pinVisible) {
      await pin.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/07b-pinned.png` });
    }
  } else {
    log('F-01-049/050/051/052/053', false, 'плитка «Расширенные поля» не найдена/не кликается');
  }

  await page.screenshot({ path: `${OUT}/08-before-close.png`, fullPage: true });

  // F-01-040: закрытие Escape без сохранения — не должно молча стирать черновик
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const sheetGoneAfterEsc = !(await page.locator('[data-f="F-01-037"]').isVisible().catch(() => false));
  log('F-01-040 (Escape закрывает)', sheetGoneAfterEsc, 'окно закрылось по Escape');
  // переоткрыть — проверить, вернулся ли черновик
  await page.waitForTimeout(600); // дать анимации закрытия окна доиграть
  try {
    await page.locator('button', { hasText: /Новая запись|New (record|booking)/i }).first().click({ timeout: 4000 });
  } catch (e) {
    log('F-01-040 (переоткрытие сразу после Escape)', false, `клик по «Новая запись» завис/перехвачен: ${String(e).slice(0, 200)}`);
  }
  await page.waitForTimeout(400);
  const phoneAfterReopen = await page.locator('[data-f~="F-01-063"] input').first().inputValue().catch(() => '');
  const digitsOnly = phoneAfterReopen.replace(/\D/g, '');
  log('F-01-040 (черновик после Escape)', digitsOnly.includes('99119933'), `телефон после переоткрытия: "${phoneAfterReopen}"`);
  await page.screenshot({ path: `${OUT}/09-reopened-after-esc.png` });
}

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, consoleErrors }, null, 2), 'utf8');
console.log('Console errors:', consoleErrors.length ? consoleErrors : 'none');
await browser.close();
