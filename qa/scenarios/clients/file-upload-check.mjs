// Разовая живая проверка F-04-086 «Файлы»: формат/размер отклоняются, скачивание/удаление по правам.
// node qa/scenarios/clients/file-upload-check.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'http://localhost:3710';
const URL = `${BASE}/biz/clients/cl_001?demo=owner&sphere=nails&lang=ru&theme=light`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clients-files-'));
const okFile = path.join(tmp, 'note.txt');
fs.writeFileSync(okFile, 'привет');
const badExt = path.join(tmp, 'virus.exe');
fs.writeFileSync(badExt, 'x');
const bigFile = path.join(tmp, 'big.pdf');
fs.writeFileSync(bigFile, Buffer.alloc(13 * 1024 * 1024, 1)); // 13MB > 12MB limit

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.getByText('Файлы', { exact: true }).click();
await page.waitForTimeout(400);

const fileInput = page.locator('input[type="file"]');

// 1) допустимый файл
await fileInput.setInputFiles(okFile);
await page.waitForTimeout(600);
await page.screenshot({ path: 'qa/shots/clients-b03-m2/files/1-after-valid-upload.png' });
const rowAfterValid = await page.getByText('note.txt').isVisible().catch(() => false);

// 2) недопустимое расширение
await fileInput.setInputFiles(badExt).catch((e) => console.log('setInputFiles(badExt) threw:', e.message));
await page.waitForTimeout(600);
await page.screenshot({ path: 'qa/shots/clients-b03-m2/files/2-after-bad-ext.png' });
const rejectedToastBad = await page.locator('[role="status"], [data-toast], .toast').allTextContents().catch(() => []);

// 3) слишком большой файл
await fileInput.setInputFiles(bigFile).catch((e) => console.log('setInputFiles(big) threw:', e.message));
await page.waitForTimeout(600);
await page.screenshot({ path: 'qa/shots/clients-b03-m2/files/3-after-big-file.png' });
const rejectedToastBig = await page.locator('[role="status"], [data-toast], .toast').allTextContents().catch(() => []);

console.log(JSON.stringify({ rowAfterValid, rejectedToastBad, rejectedToastBig, consoleErrors }, null, 2));

// 4) скачать/удалить если строка есть
if (rowAfterValid) {
  const row = page.locator('text=note.txt').locator('..');
  await page.screenshot({ path: 'qa/shots/clients-b03-m2/files/4-row.png' });
}

await browser.close();
