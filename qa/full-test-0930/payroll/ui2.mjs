// Действие F-09-039: схема администратора — «Вознаграждение за созданную запись» 500 → сохранить → перезагрузка → расчёт.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/payroll/ui';
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => log.push('pageerror ' + String(e).slice(0, 150)));
  await page.goto(`${B}/biz/payroll/staff/st_nuri_admin?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  log.push('url ' + page.url());
  const input = page.locator('label:has-text("Вознаграждение за созданную запись")').locator('xpath=ancestor::*[.//input][1]//input').first();
  log.push('text на странице: ' + ((await page.innerText('body')).includes('Вознаграждение за созданную запись')));
  const byLabel = page.getByLabel('Вознаграждение за созданную запись', { exact: false });
  log.push('getByLabel: ' + await byLabel.count() + ', xpath input: ' + await input.count());
  const target = (await byLabel.count()) ? byLabel.first() : input;
  await target.fill('500');
  await page.screenshot({ path: `${OUT}/scheme-admin-records.png`, fullPage: true, timeout: 90000 }).catch(() => {});
  await page.getByRole('button', { name: /^Сохранить/ }).last().click();
  await page.waitForTimeout(2500);
  log.push('после сохранения: ' + ((await page.innerText('body')).match(/Схема сохранена|Не удалось[^\n]*/)?.[0] ?? 'тоста нет'));
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const t2 = (await page.getByLabel('Вознаграждение за созданную запись').count()) ? page.getByLabel('Вознаграждение за созданную запись').first() : page.locator('label:has-text("Вознаграждение за созданную запись")').locator('xpath=ancestor::*[.//input][1]//input').first();
  log.push('после перезагрузки: ' + await t2.inputValue().catch(e => 'ERR ' + e));
  await page.goto(`${B}/biz/payroll/period?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const txt = await page.innerText('main');
  log.push('период (сегодня): ' + (txt.match(/Лилит Мкртчян[\s\S]{0,60}/)?.[0] ?? '').replace(/\n/g, ' / '));
  await page.screenshot({ path: `${OUT}/period-after-records.png`, timeout: 90000 }).catch(() => {});
} catch (e) { log.push('ERR ' + String(e).slice(0, 300)); }
finally { await browser.close(); release(); fs.writeFileSync(`${OUT}/log2.txt`, log.join('\n')); console.log(log.join('\n')); }
