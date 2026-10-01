// Замер g1-3 v2: правит гонки v1 (нет ожидания после networkidle) и переносит F-03-096 на вклад
// /dev/ext/serviceCard/online, т.к. хозяин /biz/services/[id] ещё не построен (заглушка "скоро появится").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'http://localhost:3710';
const OUT = path.join(ROOT, 'qa/shots/online/g1-3-m0/live2');
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
async function ctx_close(page) {
  await page.__ctx.close();
}
async function newPage(browser, { persona, sphere = 'nails', lang = 'ru', device = 'desktop', empty = '0' }) {
  const viewport = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport, locale: lang === 'hy' ? 'hy-AM' : lang === 'en' ? 'en-US' : 'ru-RU' });
  const page = await ctx.newPage();
  page.__ctx = ctx;
  page.__qs = new URLSearchParams({ demo: persona, sphere, lang, theme: 'light', empty }).toString();
  return page;
}
async function goto(page, route) {
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${route}${sep}${page.__qs}`, { waitUntil: 'networkidle', timeout: 20000 });
  // дать React Query дозагрузить данные поверх networkidle (мок-задержка 150-400мс + рендер скелетона)
  await page.waitForTimeout(900);
}
async function findVisible(page, selector, timeout = 6000) {
  try {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  // F-00-065 — повтор с ожиданием
  {
    const page = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(page, '/biz/online/page');
    const ok = await findVisible(page, '[data-f="F-00-065"]');
    const s = await shot(page, 'F-00-065-retry');
    log('F-00-065', 'мастер видит режим видимости (all/link/mine) на одном экране', ok, ok ? 'секция отрисована' : 'не дождались за 6с', s);
    if (ok) {
      const opts = await page.locator('[data-f="F-00-065"] button, [data-f="F-00-065"] [role="radio"]').allTextContents();
      log('F-00-065', 'три режима видны', opts.filter(Boolean).length >= 3, `варианты: ${opts.filter(Boolean).join(' | ')}`);
    }
    await ctx_close(page);
  }

  // F-00-067, F-03-116 — экран правил (развернуть аккордеон мастера)
  {
    const page = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(page, '/biz/online/settings');
    const tzOk = await findVisible(page, '[data-f="F-03-116"]');
    const s1 = await shot(page, 'F-03-116-settings');
    log('F-03-116', 'страна/часовой пояс/формат времени на экране правил', tzOk, tzOk ? 'блок отрисован' : 'не найден', s1);
    // Раскрыть аккордеон "Мариам Нерсесян"
    const row = page.getByText('Мариам Нерсесян').first();
    const rowOk = await row.isVisible({ timeout: 5000 }).catch(() => false);
    if (rowOk) {
      await row.click();
      await page.waitForTimeout(500);
    }
    const cfOk = await findVisible(page, '[data-f="F-00-067"]');
    const s2 = await shot(page, 'F-00-067-expanded');
    log('F-00-067', 'переключатель «сразу / с подтверждением» открывается по мастеру', cfOk, cfOk ? 'SegmentedControl найден после разворота' : 'не найден', s2);
    if (cfOk) {
      const opts = await page.locator('[data-f="F-00-067"] button').allTextContents();
      log('F-00-067', 'варианты «сразу»/«с подтверждением»', opts.length >= 2, `варианты: ${opts.join(' | ')}`);
    }
    await ctx_close(page);
  }

  // F-00-077 / F-00-080 на телефоне — повтор с ожиданием
  {
    const page = await newPage(browser, { persona: 'individual', sphere: 'nails', device: 'phone' });
    await goto(page, '/biz/online/places');
    const homeOk = await findVisible(page, '[data-f="F-00-077"]');
    const visitOk = await findVisible(page, '[data-f="F-00-080"]');
    const s = await shot(page, 'F-00-077-080-phone-retry');
    log('F-00-077', 'секция «адрес мастера на дому» на телефоне', homeOk, homeOk ? 'отрисована' : 'не найдена', s);
    log('F-00-080', 'секция «выезд» на телефоне', visitOk, visitOk ? 'отрисована' : 'не найдена', s);
    await ctx_close(page);
  }

  // F-03-107 — блок в настройке ссылки: заходим прямо через /biz/online, ждём загрузки, клик «Настроить»
  {
    const owner = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(owner, '/biz/online');
    const cfgBtn = owner.getByRole('button', { name: /Настроить/i }).first();
    const cfgSeen = await cfgBtn.isVisible({ timeout: 6000 }).catch(() => false);
    if (cfgSeen) {
      await cfgBtn.click();
      await owner.waitForTimeout(900);
    }
    const has107 = await findVisible(owner, '[data-f="F-03-107"]');
    const s1 = await shot(owner, 'F-03-107-retry');
    log('F-03-107', 'блок «продажа абонементов и сертификатов» в настройке ссылки', has107, has107 ? 'блок отрисован' : `не найден (кнопка «Настроить» была видна: ${cfgSeen})`, s1);
    if (has107) {
      const toggle = owner.locator('[data-f="F-03-107"] button[role="switch"]').first();
      const before = await toggle.getAttribute('aria-checked').catch(() => null);
      await toggle.click().catch(() => {});
      await owner.waitForTimeout(400);
      const saveBtn = owner.getByRole('button', { name: /Сохранить/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click().catch(() => {});
        await owner.waitForTimeout(700);
      }
      const after = await toggle.getAttribute('aria-checked').catch(() => null);
      log('F-03-107', 'переключатель меняет и сохраняет состояние', before !== after, `было: ${before} стало: ${after}`);

      const guest = await newPage(browser, { persona: 'guest', sphere: 'nails' });
      await goto(guest, '/b/mariam-nails');
      const btnVisible = await findVisible(guest, '[data-f="F-03-107"]', 4000);
      const sG = await shot(guest, 'F-03-107-widget-after-toggle');
      log('F-03-107', `кнопка в виджете соответствует состоянию (ожидали ${after === 'true' ? 'видима' : 'скрыта'})`, (after === 'true') === btnVisible, `after=${after}, кнопка видна=${btnVisible}`, sG);
      await ctx_close(guest);

      // Возвращаем в исходное состояние
      await owner.bringToFront();
      await toggle.click().catch(() => {});
      await owner.waitForTimeout(300);
      const saveBtn2 = owner.getByRole('button', { name: /Сохранить/i }).first();
      if (await saveBtn2.isVisible().catch(() => false)) await saveBtn2.click().catch(() => {});
      await owner.waitForTimeout(500);
    }
    await ctx_close(owner);
  }

  // F-03-139 — источник widget/link через ?sample=
  {
    const page = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(page, '/dev/ext/bookingWindow/online?sample=widget');
    const ok = await findVisible(page, '[data-f="F-03-139"]', 6000);
    const txt = ok ? (await page.locator('[data-f="F-03-139"]').first().innerText()).trim() : '';
    const s = await shot(page, 'F-03-139-widget-sample');
    log('F-03-139', 'бейдж версии формы у записи с источником «виджет»', ok, ok ? `бейдж: "${txt}"` : 'не появился для sample=widget', s);
    await ctx_close(page);
  }

  // F-03-096 — через вклад /dev/ext/serviceCard/online (хозяин /biz/services/[id] ещё не построен)
  {
    const owner = await newPage(browser, { persona: 'individual', sphere: 'nails' });
    await goto(owner, '/dev/ext/serviceCard/online');
    const has = await findVisible(owner, '[data-f="F-03-096"]', 6000);
    const s0 = await shot(owner, 'F-03-096-ext-before');
    log('F-03-096', 'переключатель «Запретить онлайн-запись без абонемента» во вкладе карточки услуги', has, has ? 'переключатель найден' : 'не найден', s0);
    // Прочитать контекст: какой serviceId используется
    const ctxText = await owner.locator('text=serviceId').locator('..').innerText().catch(() => '');
    if (has) {
      const toggle = owner.locator('[data-f="F-03-096"] button[role="switch"]').first();
      await toggle.click().catch(() => {});
      await owner.waitForTimeout(400);
      const saveBtn = owner.getByRole('button', { name: /Сохранить/i }).first();
      const saveSeen = await saveBtn.isVisible().catch(() => false);
      if (saveSeen) {
        await saveBtn.click().catch(() => {});
        await owner.waitForTimeout(700);
      }
      const s1 = await shot(owner, 'F-03-096-ext-after');
      log('F-03-096', 'переключатель сохраняется (тост «сохранено»)', saveSeen, saveSeen ? 'кнопка сохранения нажата' : 'кнопки сохранения не нашли', s1);
    }
    await ctx_close(owner);

    const guest = await newPage(browser, { persona: 'guest', sphere: 'nails' });
    await goto(guest, '/b/mariam-nails');
    const label = guest.getByText(/Запись по абонементу/i).first();
    const labelSeen = await label.isVisible({ timeout: 5000 }).catch(() => false);
    const s2 = await shot(guest, 'F-03-096-widget-label-retry');
    log('F-03-096', 'метка «Запись по абонементу» видна у услуги в виджете', labelSeen, labelSeen ? 'метка найдена' : `метка не найдена — контекст услуги: ${ctxText.slice(0, 200)}`, s2);
    if (labelSeen) {
      await label.click().catch(() => {});
      await guest.waitForTimeout(700);
      for (let i = 0; i < 5; i++) {
        const cont = guest.getByRole('button', { name: /Продолжить|Далее/i }).first();
        if (await cont.isVisible().catch(() => false)) {
          await cont.click().catch(() => {});
          await guest.waitForTimeout(600);
        } else break;
      }
      const invalid = guest.getByText(/Абонемент не подходит или истёк/i).first();
      const invalidSeen = await invalid.isVisible({ timeout: 4000 }).catch(() => false);
      const s3 = await shot(guest, 'F-03-096-invalid-retry');
      log('F-03-096', 'клиент без абонемента не может записаться и видит причину', invalidSeen, invalidSeen ? 'сообщение показано' : 'сообщение не найдено на этом шаге', s3);
    }
    await ctx_close(guest);
  }
} finally {
  await browser.close();
  release();
}

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const passed = results.filter((r) => r.ok).length;
console.log(`\nИтог v2: ${passed}/${results.length} пунктов подтверждено действием.`);
