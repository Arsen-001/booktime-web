// ⭐ «День закрыт» владельцу в колокольчик: админ закрывает день → владелец видит строку → по нажатию «Итоги дня».
//   node qa/queue-1001b/dayclose-shots.mjs [ru|en] [390|1440]
import path from 'node:path';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const [lang = 'ru', width = '1440'] = process.argv.slice(2);
const w = Number(width);
const OUT = path.resolve('qa/queue-1001b/dayclose');
const BASE = 'http://localhost:3710';
const ru = lang === 'ru';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
const tag = `${lang}-${w}`;
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}__${tag}.png`) });
try {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push('pageerror ' + String(e).slice(0, 200)));
  page.on('console', (m) => m.type() === 'error' && log.push('console ' + m.text().slice(0, 160)));
  const q = (persona) => `?data=mock&demo=${persona}&sphere=nails&lang=${lang}`;

  const openShift = async () => {
    await page.goto(`${BASE}/biz/finance/shift${q('admin')}`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(1500);
    const openBtn = page.getByRole('button', { name: ru ? 'Открыть смену' : 'Open shift', exact: true }).first();
    if (await openBtn.count()) {
      await openBtn.click();
      await page.waitForTimeout(600);
      await page.locator('[role="dialog"] input').first().fill('20000');
      await page.locator('[role="dialog"] button').filter({ hasText: ru ? 'Открыть смену' : 'Open shift' }).last().click();
      await page.waitForTimeout(1500);
    }
  };
  const closeDay = async (delta, name) => {
    await page.goto(`${BASE}/biz/journal${q('admin')}`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('journal:workday', { detail: { kind: 'dayClose' } })));
    await page.waitForTimeout(2000);
    const dlg = page.locator('[role="dialog"]');
    const text = await dlg.innerText();
    const m = text.match(new RegExp(`${ru ? 'Должно быть в ящике' : 'Should be in the drawer'}[^\\d]*([\\d\\s\\u00a0\\u202f,]+)`));
    const expected = m ? Number(m[1].replace(/[^\d]/g, '')) : 0;
    const input = dlg.locator('input').last();
    if (!(await input.count())) {
      await shot(page, 'debug-noinput');
      log.push('нет поля: ' + text.slice(0, 400).replace(/\n/g, ' / '));
    }
    await input.scrollIntoViewIfNeeded();
    await input.fill(String(expected + delta));
    await page.waitForTimeout(300);
    if (name) await shot(page, name);
    await dlg.getByRole('button', { name: ru ? 'Закрыть день' : 'Close the day' }).click();
    await page.waitForTimeout(2000);
    log.push(`закрыто: ожидалось ${expected}, насчитали ${expected + delta}`);
  };
  const bellRows = async (persona) => {
    if (persona) {
      await page.goto(`${BASE}/biz/clients${q(persona)}`, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(2000);
    }
    for (let i = 0; i < 3 && (await page.locator('[role="dialog"]').count()); i += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    const bell = page.getByRole('button', { name: ru ? 'Уведомления' : 'Notifications' }).first();
    await bell.click();
    await page.waitForTimeout(1200);
    const pop = page.locator('[role="dialog"], [data-radix-popper-content-wrapper], [role="menu"]').last();
    return { pop, text: await pop.innerText().catch(() => '') };
  };
  const closedTitle = (t) => (t.match(ru ? /День закрыт · \S+/g : /\S+ closed the day/g) ?? []);

  // 1. Админ открывает смену и закрывает день с недостачей 500
  await openShift();
  await closeDay(-500, 'admin-count');
  // 2. Админ (закрывший) — у себя строки не видит
  const adminBell = await bellRows('admin');
  log.push(`админ видит «День закрыт»: ${closedTitle(adminBell.text).length}`);
  await page.keyboard.press('Escape');
  // 3. Владелец — строка в колокольчике
  const ownerBell = await bellRows('owner');
  log.push(`владелец: ${closedTitle(ownerBell.text).join(' | ')}`);
  log.push('строка: ' + (ownerBell.text.split('\n').find((l) => /Выручка|Revenue/.test(l)) ?? 'нет'));
  await shot(page, 'owner-bell');
  // 4. Нажатие → «Итоги дня» за эту дату
  await ownerBell.pop.getByText(ru ? /День закрыт/ : /closed the day/).first().click();
  await page.waitForTimeout(2500);
  const sheet = page.locator('[role="dialog"]').last();
  log.push('открыто: ' + (await sheet.innerText().catch(() => '')).split('\n').slice(0, 2).join(' / '));
  log.push('адрес: ' + page.url().replace(BASE, ''));
  await shot(page, 'owner-dayclose-sheet');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  // 4б. Центр уведомлений — та же строка
  await page.goto(`${BASE}/biz/notifications/inbox${q('owner')}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot(page, 'owner-inbox');
  // 5. Переоткрыть смену и закрыть с тем же пересчётом — дубля нет
  await openShift();
  await closeDay(0);
  const again = await bellRows('owner');
  log.push(`после повторного закрытия у владельца строк: ${closedTitle(again.text).length}`);
  await page.keyboard.press('Escape');
  // 6. Настройка: «Уведомления в Web-версии» → «Закрытие дня»
  await page.goto(`${BASE}/biz/notifications/channels${q('owner')}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  const box = page.getByText(ru ? 'Закрытие дня' : 'Day closed', { exact: true }).first();
  await box.scrollIntoViewIfNeeded();
  await shot(page, 'owner-settings');
  await box.click();
  await page.waitForTimeout(1500);
  const off = await bellRows();
  log.push(`галочка выключена — строк: ${closedTitle(off.text).length}`);
  await page.keyboard.press('Escape');
  await box.click();
  await page.waitForTimeout(1000);
  await ctx.close();
} finally {
  await browser.close();
  release();
}
console.log(`[${tag}]\n` + log.join('\n'));
