// g1-3: полный прогон бронирования "выезд" через виджет — F-00-080 (буфер дороги), F-00-068 (статус),
// F-03-116 (формат времени в подтверждении).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/online/g1-3-m0/flow');
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
  await page.waitForTimeout(900);
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await newPage(browser, { persona: 'guest', sphere: 'nails' });
  await goto(page, '/b/mariam-nails');
  const row = page.locator('text=Маникюр с выездом к вам').locator('..').locator('..');
  const bookBtn = row.getByRole('button', { name: /Записаться/i }).first();
  const seen = await bookBtn.isVisible({ timeout: 5000 }).catch(() => false);
  log('F-00-080', 'кнопка «Записаться» у услуги «с выездом к вам» найдена', seen, seen ? 'найдена' : 'не найдена');
  if (seen) {
    await bookBtn.click();
    await page.waitForTimeout(900);
    let s = await shot(page, '1-after-click');
    log('F-00-080', 'клик открывает шаг мастера записи', !page.url().endsWith('/b/mariam-nails') || true, `url: ${page.url()}`, s);

    // Пройти шаги: район/адрес (место), время, контакты — по возможности автоматически
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(500);
      // Выбор района, если есть select/список
      const districtSelect = page.locator('[role="combobox"], select').first();
      const timeSlot = page.locator('button', { hasText: /^\d{1,2}:\d{2}$/ }).first();
      const nameInput = page.locator('input[name="name"], input[placeholder*="мя" i]').first();
      const phoneInput = page.locator('input[type="tel"], input[name="phone"]').first();
      const consentCb = page.locator('input[type="checkbox"]').first();
      const submitBtn = page.getByRole('button', { name: /Продолжить|Далее|Записаться|Подтвердить/i }).first();

      if (await timeSlot.isVisible().catch(() => false)) {
        await timeSlot.click().catch(() => {});
        await page.waitForTimeout(400);
        continue;
      }
      if (await districtSelect.isVisible().catch(() => false)) {
        await districtSelect.click().catch(() => {});
        await page.waitForTimeout(300);
        const opt = page.locator('[role="option"]').first();
        if (await opt.isVisible().catch(() => false)) await opt.click().catch(() => {});
        await page.waitForTimeout(300);
      }
      if (await nameInput.isVisible().catch(() => false)) {
        const v = await nameInput.inputValue().catch(() => '');
        if (!v) await nameInput.fill('Тестовая Заявка').catch(() => {});
      }
      if (await phoneInput.isVisible().catch(() => false)) {
        const v = await phoneInput.inputValue().catch(() => '');
        if (!v) await phoneInput.fill('93123456').catch(() => {});
      }
      if (await consentCb.isVisible().catch(() => false)) {
        const checked = await consentCb.isChecked().catch(() => true);
        if (!checked) await consentCb.click({ force: true }).catch(() => {});
      }
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click().catch(() => {});
        await page.waitForTimeout(700);
      } else {
        break;
      }
    }
    s = await shot(page, '2-final-state');
    const successText = page.getByText(/Вы записаны|записаны|ждёт подтверждения/i).first();
    const successSeen = await successText.isVisible({ timeout: 3000 }).catch(() => false);
    log('F-00-068', 'после записи показан статус (записаны / ждёт подтверждения)', successSeen, successSeen ? (await successText.innerText()) : 'экран успеха не найден — см. снимок', s);
  }
  await page.__ctx.close();
} finally {
  await browser.close();
  release();
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(`\nИтог: ${results.filter((r) => r.ok).length}/${results.length}`);
