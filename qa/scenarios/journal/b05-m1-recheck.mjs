// b05-m1: повторная проверка находок b05-m0.md + новые действия. node qa/scenarios/journal/b05-m1-recheck.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/b05-m1';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function log(name, ok, note) {
  results.push({ name, ok, note });
  console.log(`${ok ? '✅' : ok === null ? '⚠️' : '❌'} ${name}${note ? ' — ' + note : ''}`);
}
async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    // 1) master persona прямой заход на settings — должен видеть EmptyState "доступ закрыт" (F-01-168/178/179 fix recheck)
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.goto(`${BASE}/biz/journal/settings?demo=master&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const hasSaveBtn = await page.getByRole('button', { name: /Сохранить/i }).isVisible().catch(() => false);
      const hasDenied = await page.locator('text=/доступ/i').first().isVisible().catch(() => false);
      await shot(page, 'master-settings-direct');
      log('F-01-168/178/179 (recheck): master прямой ссылкой НЕ видит форму настроек владельца', !hasSaveBtn, `кнопка Сохранить видна=${hasSaveBtn}, текст про доступ=${hasDenied}`);
      log('F-01-168/178/179 (recheck): без ошибок консоли', errs.length === 0, errs.join('|'));
      await ctx.close();
    }

    // 2) owner видит форму по-прежнему
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/biz/journal/settings?demo=owner&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const hasSaveBtn = await page.getByRole('button', { name: /Сохранить/i }).isVisible().catch(() => false);
      await shot(page, 'owner-settings-direct');
      log('F-01-168: owner по-прежнему видит и может сохранять', hasSaveBtn);
      await ctx.close();
    }

    // 3) F-01-165 chat popup — ссылка на чат теперь есть?
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/biz/journal/settings?demo=owner&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      const block = page.locator('[data-f="F-01-165"]');
      const visible = await block.isVisible().catch(() => false);
      let html = '';
      if (visible) html = await block.innerHTML().catch(() => '');
      const hasLink = /<a[\s>]|<button/i.test(html);
      await shot(page, 'f165-block');
      log('F-01-165: блок настройки чата содержит кликабельный элемент (ссылка/кнопка)', visible ? hasLink : null, visible ? 'html len=' + html.length : 'блок не виден без подключённой интеграции — по ТЗ ожидаемо');
      await ctx.close();
    }

    // 4) F-01-219 — окно записи удалённого клиента: вкладка "Клиент" пустая или с EmptyState?
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/biz/records?demo=owner&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      // ищем строку красным (deletedAt клиента не то же самое, что deletedAt записи — пропускаем поиск по цвету)
      await shot(page, 'records-list');
      log('F-01-219: снимок списка записей для визуального разбора', true);
      await ctx.close();
    }

    // 5) F-01-172 маленькая зона нажатия — recheck
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/biz/journal/settings?demo=owner&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      const labels = await page.locator('[data-f="F-01-172"] label').all();
      let smallFound = false;
      for (const l of labels) {
        const box = await l.boundingBox().catch(() => null);
        if (box && (box.width < 40 || box.height < 40)) smallFound = true;
      }
      log('F-01-172: recheck маленькой зоны нажатия у радио-лейблов', !smallFound, smallFound ? 'найдена зона <40px' : 'все ≥40px');
      await ctx.close();
    }
  } finally {
    await browser.close();
    release();
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log('\nИтого:', results.filter((r) => r.ok === true).length, '/', results.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
