// v4: мок-база живёт в localStorage БРАУЗЕРА — owner и guest должны быть в ОДНОМ контексте (разные
// вкладки одного context), иначе правка не видна другой стороне (это баг сценария v3, не продукта).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/online/g1-3-m0/live4');
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
function qs({ persona, sphere = 'nails', lang = 'ru', theme = 'light', empty = '0' }) {
  return new URLSearchParams({ demo: persona, sphere, lang, theme, empty }).toString();
}
async function goto(page, route, params) {
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${route}${sep}${qs(params)}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(900);
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
  const owner = await ctx.newPage();
  const guest = await ctx.newPage();

  // 1) Владелец: включить subscriptionOnly на sv_mar_gel (уже могло остаться включённым с прошлого прогона — проверим и включим, если нет)
  await goto(owner, '/dev/ext/serviceCard/online', { persona: 'individual', sphere: 'nails' });
  const block = owner.locator('[data-f="F-03-096"]').first();
  const cb = block.locator('input[type="checkbox"]').first();
  const wasChecked = await cb.isChecked().catch(() => false);
  if (!wasChecked) {
    await block.locator('label').first().click();
    await owner.waitForTimeout(700);
  }
  const nowChecked = await cb.isChecked().catch(() => false);
  log('F-03-096', 'переключатель «Запретить онлайн-запись без абонемента» включён на услуге', nowChecked, `было включено: ${wasChecked}, сейчас: ${nowChecked}`);

  // 2) Гость в ТОМ ЖЕ контексте (общий localStorage): виджет той же бизнес-локации
  await goto(guest, '/b/mariam-nails', { persona: 'guest', sphere: 'nails' });
  const label = guest.getByText(/Запись по абонементу/i).first();
  const labelSeen = await label.isVisible({ timeout: 5000 }).catch(() => false);
  const s1 = await shot(guest, '1-widget-label');
  log('F-03-096', 'метка «Запись по абонементу» видна у услуги в виджете (тот же браузер)', labelSeen, labelSeen ? 'метка найдена' : 'метка не найдена', s1);

  if (labelSeen) {
    await guest.getByRole('button', { name: /Записаться/i }).first().click().catch(async () => {
      await label.click();
    });
    await guest.waitForTimeout(800);
    let advanced = 0;
    for (let i = 0; i < 6; i++) {
      const cont = guest.getByRole('button', { name: /Продолжить|Далее/i }).first();
      if (await cont.isVisible().catch(() => false)) {
        await cont.click().catch(() => {});
        await guest.waitForTimeout(700);
        advanced++;
      } else break;
    }
    const invalid = guest.getByText(/Абонемент не подходит или истёк/i).first();
    const invalidSeen = await invalid.isVisible({ timeout: 4000 }).catch(() => false);
    const s2 = await shot(guest, '2-invalid-or-progress');
    log(
      'F-03-096',
      'клиент без подходящего абонемента не может записаться и видит причину',
      invalidSeen,
      invalidSeen ? 'сообщение показано' : `не найдено (шагов пройдено: ${advanced}) — см. снимок`,
      s2,
    );
  }

  // Возврат в исходное состояние (выключить, если мы его включали в этом прогоне)
  if (!wasChecked) {
    await owner.bringToFront();
    await block.locator('label').first().click().catch(() => {});
    await owner.waitForTimeout(500);
  }

  // ─── F-03-107 на СЕТЕВОМ бизнесе (manana-nor-nork) — там блок реально доступен ───
  const owner2 = await ctx.newPage();
  await goto(owner2, '/biz/online', { persona: 'network', sphere: 'nails' });
  const cfgLink = owner2.getByRole('link', { name: /Настроить/i }).first();
  const cfgSeen = await cfgLink.isVisible({ timeout: 8000 }).catch(() => false);
  if (cfgSeen) {
    await cfgLink.click();
    await owner2.waitForTimeout(1000);
  }
  const block107 = owner2.locator('[data-f="F-03-107"]').first();
  const has107 = await block107.isVisible({ timeout: 6000 }).catch(() => false);
  const s3 = await shot(owner2, '3-f03107-network');
  log('F-03-107', 'блок «продажа абонементов и сертификатов» на сетевом бизнесе', has107, has107 ? 'блок отрисован' : `не найден (cfgSeen=${cfgSeen})`, s3);
  if (has107) {
    const toggle = block107.locator('button[role="switch"]').first();
    const before = await toggle.getAttribute('aria-checked').catch(() => null);
    await toggle.click().catch(() => {});
    await owner2.waitForTimeout(700);
    const after = await toggle.getAttribute('aria-checked').catch(() => null);
    log('F-03-107', 'переключатель меняет состояние (сохраняется сразу, без кнопки)', before !== after, `было: ${before} стало: ${after}`);

    const guestSlug = owner2.url();
    // Узнать slug сетевого бизнеса из адресной строки ссылки на форму — берём известный из сида
    const guest2 = await ctx.newPage();
    await goto(guest2, '/b/manana-nor-nork', { persona: 'guest', sphere: 'nails' });
    const btnVisible = await guest2.locator('[data-f="F-03-107"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    const s4 = await shot(guest2, '4-widget-sales-btn');
    const expectVisible = after === 'true';
    log('F-03-107', `кнопка продаж в виджете совпадает с настройкой (ожидали ${expectVisible ? 'видима' : 'скрыта'})`, expectVisible === btnVisible, `after=${after} видна=${btnVisible}`, s4);
    await guest2.close();

    // откат
    await toggle.click().catch(() => {});
    await owner2.waitForTimeout(500);
  }
} finally {
  await browser.close();
  release();
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(`\nИтог v4: ${results.filter((r) => r.ok).length}/${results.length}`);
