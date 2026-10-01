import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/online/g1-3-m0/live3');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function log(fid, item, ok, note, shot) {
  results.push({ fid, item, ok, note, shot });
  console.log(`${ok ? '✅' : '❌'} ${fid} · ${item} — ${note}${shot ? ` [${shot}]` : ''}`);
}
async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return path.relative(ROOT, p);
}
async function newPage(browser, { persona, sphere = 'nails', lang = 'ru', device = 'desktop', empty = '0' }) {
  const viewport = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport, locale: 'ru-RU' });
  const page = await ctx.newPage();
  page.__ctx = ctx;
  page.__qs = new URLSearchParams({ demo: persona, sphere, lang, theme: 'light', empty }).toString();
  return page;
}
async function goto(page, route) {
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${route}${sep}${page.__qs}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1200);
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  // F-03-107 retry: navigate straight to /biz/online, generous wait before clicking
  {
    const owner = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(owner, '/biz/online');
    await shot(owner, 'F-03-107-list-loaded');
    const cfgBtn = owner.getByRole('link', { name: /Настроить/i }).first();
    await cfgBtn.waitFor({ state: 'visible', timeout: 10000 });
    await cfgBtn.click();
    await owner.waitForTimeout(1200);
    const block = owner.locator('[data-f="F-03-107"]').first();
    const has107 = await block.isVisible({ timeout: 8000 }).catch(() => false);
    const s1 = await shot(owner, 'F-03-107-detail');
    log('F-03-107', 'блок «продажа абонементов и сертификатов» в настройке ссылки', has107, has107 ? 'блок отрисован' : 'не найден на детальной странице ссылки', s1);
    if (has107) {
      const toggle = block.locator('button[role="switch"], input[type="checkbox"]').first();
      const kind = await toggle.evaluate((el) => el.tagName).catch(() => '?');
      const before = kind === 'BUTTON' ? await toggle.getAttribute('aria-checked') : String(await toggle.isChecked().catch(() => null));
      await toggle.click({ force: true }).catch(() => {});
      await owner.waitForTimeout(500);
      const saveBtn = owner.getByRole('button', { name: /Сохранить/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click().catch(() => {});
        await owner.waitForTimeout(800);
      }
      const after = kind === 'BUTTON' ? await toggle.getAttribute('aria-checked') : String(await toggle.isChecked().catch(() => null));
      log('F-03-107', 'переключатель меняет и сохраняет состояние', before !== after, `было: ${before} стало: ${after}`);

      const guest = await newPage(browser, { persona: 'guest', sphere: 'nails' });
      await goto(guest, '/b/mariam-nails');
      const btnVisible = await guest.locator('[data-f="F-03-107"]').first().isVisible({ timeout: 5000 }).catch(() => false);
      const sG = await shot(guest, 'F-03-107-widget-check');
      const expectVisible = after === 'true';
      log('F-03-107', `кнопка в виджете соответствует настройке (ожидали ${expectVisible ? 'видима' : 'скрыта'})`, expectVisible === btnVisible, `after=${after}, кнопка видна=${btnVisible}`, sG);
      await guest.__ctx.close();

      // revert
      await owner.bringToFront();
      await toggle.click({ force: true }).catch(() => {});
      await owner.waitForTimeout(400);
      const saveBtn2 = owner.getByRole('button', { name: /Сохранить/i }).first();
      if (await saveBtn2.isVisible().catch(() => false)) await saveBtn2.click().catch(() => {});
      await owner.waitForTimeout(500);
    }
    await owner.__ctx.close();
  }

  // F-03-096 retry: Checkbox selector (not switch), auto-save (no Save button)
  {
    const owner = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(owner, '/dev/ext/serviceCard/online');
    const block = owner.locator('[data-f="F-03-096"]').first();
    const has = await block.isVisible({ timeout: 8000 }).catch(() => false);
    log('F-03-096', 'переключатель «Запретить онлайн-запись без абонемента» найден', has, has ? 'найден' : 'не найден');
    if (has) {
      const cb = block.locator('input[type="checkbox"]').first();
      const before = await cb.isChecked().catch(() => null);
      await block.locator('label').first().click().catch(() => {});
      await owner.waitForTimeout(900);
      const after = await cb.isChecked().catch(() => null);
      const toastSeen = await owner.getByText(/сохран/i).first().isVisible({ timeout: 2000 }).catch(() => false);
      const s1 = await shot(owner, 'F-03-096-toggled');
      log('F-03-096', 'переключатель меняет и сохраняет состояние (авто-сохранение)', before !== after, `было: ${before} стало: ${after}, тост «сохранено» виден: ${toastSeen}`, s1);
    }
    await owner.__ctx.close();

    const guest = await newPage(browser, { persona: 'guest', sphere: 'nails' });
    await goto(guest, '/b/mariam-nails');
    const label = guest.getByText(/Запись по абонементу/i).first();
    const labelSeen = await label.isVisible({ timeout: 6000 }).catch(() => false);
    const s2 = await shot(guest, 'F-03-096-widget-label');
    log('F-03-096', 'метка «Запись по абонементу» видна у услуги в виджете', labelSeen, labelSeen ? 'метка найдена' : 'метка не найдена', s2);
    if (labelSeen) {
      await label.click().catch(() => {});
      await guest.waitForTimeout(800);
      let advanced = 0;
      for (let i = 0; i < 5; i++) {
        const cont = guest.getByRole('button', { name: /Продолжить|Далее/i }).first();
        if (await cont.isVisible().catch(() => false)) {
          await cont.click().catch(() => {});
          await guest.waitForTimeout(700);
          advanced++;
        } else break;
      }
      const invalid = guest.getByText(/Абонемент не подходит или истёк/i).first();
      const invalidSeen = await invalid.isVisible({ timeout: 4000 }).catch(() => false);
      const s3 = await shot(guest, 'F-03-096-invalid');
      log(
        'F-03-096',
        'клиент без абонемента не может записаться и видит причину',
        invalidSeen,
        invalidSeen ? 'сообщение показано' : `сообщение не найдено (шагов пройдено: ${advanced}) — см. снимок`,
        s3,
      );
    }
    await guest.__ctx.close();

    // Вернуть выключенным
    const owner2 = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(owner2, '/dev/ext/serviceCard/online');
    const block2 = owner2.locator('[data-f="F-03-096"]').first();
    if (await block2.isVisible({ timeout: 6000 }).catch(() => false)) {
      await block2.locator('label').first().click().catch(() => {});
      await owner2.waitForTimeout(600);
    }
    await owner2.__ctx.close();
  }
} finally {
  await browser.close();
  release();
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const passed = results.filter((r) => r.ok).length;
console.log(`\nИтог v3: ${passed}/${results.length}`);
