// Точечная проверка: editClient (индекс 2) реально гейтит кнопку «Изменить»?
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/clients-b05/rights4');
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const record = (n, ok, note) => { log.push({ n, ok, note }); console.log(`${ok ? '✅' : '❌'} ${n}${note ? ' — ' + note : ''}`); };

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
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'Лилит Мкртчян' }).click();
    await page.waitForTimeout(1200);
    const switches = page.locator('[data-f*="F-04-194"] button[role="switch"]');
    const sw = switches.nth(2); // editClient
    const before = await sw.getAttribute('aria-checked');
    await sw.click();
    await page.waitForTimeout(1800);
    const after = await sw.getAttribute('aria-checked');
    record('editClient переключён', after === 'false', `${before}->${after}`);

    await page.goto(`${BASE}/biz/clients?demo=admin&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const nameCell = page.locator('table tbody tr').first().locator('td').nth(1);
    await nameCell.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'card-editClient-off.png'), fullPage: true });
    const editBtn = page.getByRole('button', { name: 'Изменить' });
    const editBtnCount = await editBtn.count();
    let disabled = null;
    if (editBtnCount) disabled = await editBtn.first().isDisabled().catch(() => null);
    record('Без editClient кнопка «Изменить» скрыта или заблокирована', editBtnCount === 0 || disabled === true, `count=${editBtnCount}, disabled=${disabled}`);
    await context.close();
  } finally {
    await browser.close();
    release();
  }
  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log, null, 2));
  console.log(`Итого: ${log.filter(l=>l.ok).length}/${log.length}`);
}
main().catch((e) => { console.error(e); process.exit(0); });
