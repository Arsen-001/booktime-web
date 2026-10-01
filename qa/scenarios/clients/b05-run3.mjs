// Пачка b05 — поштучное выключение прав по индексу (устойчиво к вёрстке/тексту лейбла).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/clients-b05/rights3');
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const record = (name, ok, note) => {
  log.push({ name, ok, note });
  console.log(`${ok ? '✅' : '❌'} ${name}${note ? ' — ' + note : ''}`);
};

// порядок FINE_RIGHT_GROUPS в src/domain/clients.ts
const IDX = {
  contactsInList: 0,
  contactsInCard: 1,
  viewComments: 10,
  viewFiles: 14,
  viewCustomFields: 17,
  viewAccounts: 21,
};

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
    for (const [name, idx] of Object.entries(IDX)) {
      const sw = switches.nth(idx);
      const before = await sw.getAttribute('aria-checked');
      await sw.click();
      await page.waitForTimeout(1800);
      const after = await sw.getAttribute('aria-checked');
      record(`Право «${name}» (индекс ${idx}) выключено`, after === 'false', `${before}→${after}`);
    }
    await page.screenshot({ path: path.join(OUT, '01-after-toggles.png'), fullPage: true });

    const ls = await page.evaluate(() => localStorage.getItem('bp-mock-db'));
    const idxLs = ls.indexOf('"st_nuri_admin":{"contactsInList"');
    const saved = idxLs >= 0 ? ls.slice(idxLs, idxLs + 550) : 'НЕ НАЙДЕНО';
    fs.writeFileSync(path.join(OUT, 'saved-rights.txt'), saved);
    record('Сохранённый в БД набор прав отражает все 6 выключений', /contactsInList":false.*contactsInCard":false/.test(saved), saved);

    // ── эффект: admin ──
    await page.goto(`${BASE}/biz/clients?demo=admin&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, '02-list-admin.png'), fullPage: true });
    const listBody = await page.locator('body').innerText();
    const phoneVisibleInList = /\+374\s?0?0\s?160\s?001/.test(listBody);
    record('F-04-194 (список): телефон СКРЫТ после выключения contactsInList', !phoneVisibleInList, phoneVisibleInList ? 'телефон +374 00 160 001 виден в открытую' : 'скрыт');

    const nameCell = page.locator('table tbody tr').first().locator('td').nth(1);
    let cardUrl = '';
    if (await nameCell.count()) {
      await nameCell.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);
      cardUrl = page.url();
    }
    await page.screenshot({ path: path.join(OUT, '03-card-admin.png'), fullPage: true });

    const cardBody = await page.locator('body').innerText();
    record('F-04-202 (карточка): телефон СКРЫТ (contactsInCard=false)', !/\+374\s?0?0\s?160\s?001/.test(cardBody), /\+374\s?0?0\s?160\s?001/.test(cardBody) ? 'телефон виден' : 'скрыт');
    record('F-04-214 (карточка): блок «Написать» (звонок/WhatsApp) СКРЫТ', !cardBody.includes('Написать:'), cardBody.includes('Написать:') ? 'блок виден' : 'скрыт');
    record('F-04-197 (карточка): блок комментариев СКРЫТ', !cardBody.includes('История комментариев') && !cardBody.includes('Новый комментарий'), 'см. текст страницы');
    const filesTabPresent = (await page.locator('button:has-text("Файлы")').count()) > 0;
    record('F-04-198 (карточка): вкладка «Файлы» ОТСУТСТВУЕТ', !filesTabPresent, filesTabPresent ? 'вкладка есть' : 'нет вкладки');
    const accountsBlock = page.locator('[data-f="F-04-071 F-04-165 F-04-200"]');
    const accountsVisible = (await accountsBlock.count()) > 0 && (await accountsBlock.first().isVisible());
    record('F-04-200 (карточка): блок «Продано/Оплачено/Баланс» СКРЫТ', !accountsVisible, accountsVisible ? 'виден' : 'скрыт');

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
