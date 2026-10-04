#!/usr/bin/env node
// Импорт клиентов за минуту (04.10.2026): сценарий с загрузкой файла (measure.mjs файлы не загружает).
//   bash scripts/ensure-dev.sh && node qa/e2e/clients-import.mjs [--device phone|desktop] [--lang ru|en|hy]
// Пустой бизнес (owner + empty=1): Altegio-CSV (ru) → колонки → проверка → загрузка → итог; тот же файл ещё раз —
// «загружать нечего»; Altegio-XLSX (en, строка-название над шапкой, даты ячейками) → загрузка; база клиентов.
// Снимки — qa/shots/clients-import/ (в git не идут).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const device = arg('device', 'phone');
const lang = arg('lang', 'ru');
const BASE = arg('base', 'http://localhost:3710');
const out = path.join(root, 'qa/shots/clients-import');
fs.mkdirSync(out, { recursive: true });

const T = {
  ru: { check: /Проверить/, start: /Загрузить \d+/, done: 'Готово — клиенты в базе', again: 'Загрузить другой файл', nothing: 'Загружать нечего', altegio: 'Выгрузка из Altegio' },
  en: { check: /Check/, start: /Import \d+/, done: 'Done — your clients are in', again: 'Import another file', nothing: 'Nothing to import', altegio: 'Altegio export' },
  hy: { check: /Ստուգել/, start: /Ներմուծել \d+/, done: 'Պատրաստ է', again: 'Ներմուծել այլ ֆայլ', nothing: 'Ներմուծելու բան չկա', altegio: 'Altegio-ի արտահանում' },
}[lang];

const release = await acquireBrowserSlot();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext(
  device === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } },
);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' || /\[i18n:(missing|no-en)\]/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`);
});
const shot = (name) => page.screenshot({ path: path.join(out, `${device}-${lang}-${name}.png`), fullPage: true });
const stats = async () => (await page.locator('.num-headline').allInnerTexts()).map((s) => s.replace(/\s/g, ''));
const result = {};

try {
  await page.goto(`${BASE}/biz/clients/import?demo=owner&empty=1&sphere=nails&lang=${lang}&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 30_000 });
  await shot('1-source');

  // CSV из Altegio (ru)
  await page.setInputFiles('input[type=file]', path.join(root, 'qa/fixtures/altegio-clients-ru.csv'));
  await page.getByText(T.altegio).first().waitFor({ timeout: 15_000 });
  await shot('2-mapping');
  await page.getByRole('button', { name: T.check }).click();
  await page.getByRole('button', { name: T.start }).waitFor({ timeout: 30_000 });
  result.csvCheck = await stats();
  await shot('3-check');
  await page.getByRole('button', { name: T.start }).click();
  await page.getByText(T.done).waitFor({ timeout: 60_000 });
  result.csvResult = await stats();
  await shot('4-result');

  // Тот же файл ещё раз — дублей нет
  await page.getByRole('button', { name: T.again }).click();
  await page.setInputFiles('input[type=file]', path.join(root, 'qa/fixtures/altegio-clients-ru.csv'));
  await page.getByRole('button', { name: T.check }).click();
  await page.getByText(T.nothing).waitFor({ timeout: 30_000 });
  result.csvAgain = await stats();
  await shot('5-again');

  // XLSX из Altegio (en): строка-название над шапкой, даты — ячейками Excel
  await page.getByRole('button', { name: /Назад|Back|Հետ/ }).click();
  await page.getByRole('button', { name: /Назад|Back|Հետ/ }).click();
  await page.setInputFiles('input[type=file]', path.join(root, 'qa/fixtures/altegio-clients-en.xlsx'));
  await page.getByText(T.altegio).first().waitFor({ timeout: 15_000 });
  result.xlsxPreview = await page.locator('#import-preview-title ~ ul li').first().innerText();
  await shot('6-xlsx-mapping');
  await page.getByRole('button', { name: T.check }).click();
  await page.getByRole('button', { name: T.start }).waitFor({ timeout: 30_000 });
  result.xlsxCheck = await stats();
  await page.getByRole('button', { name: T.start }).click();
  await page.getByText(T.done).waitFor({ timeout: 60_000 });
  result.xlsxResult = await stats();
  await shot('7-xlsx-result');

  await page.goto(`${BASE}/biz/clients`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot('8-base');
  result.ok = true;
} catch (e) {
  result.ok = false;
  result.error = String(e).slice(-1500);
  await shot('error').catch(() => {});
} finally {
  result.errors = errors;
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  release();
}
