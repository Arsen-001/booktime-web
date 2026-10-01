// QA 30.09 — integrations: настройки подключённых приложений (F-13-140…F-13-211) действием.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/integrations';
const APPS = ['АрМ СМС Шлюз', 'ВатсЧат для бизнеса', 'WABA-шлюз «Ани»', 'Диалог+', 'Промоблок в виджете записи', 'Штамп-карта в кошельке', 'Гугл Аналитика', 'Бизнес-аналитика Metrika360', 'Beauty AI', 'Интеграция с Kommo', 'FastSign'];
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 200)}`); });
const text = () => p.locator('main').innerText();
const toast = async () => { await p.waitForTimeout(700); return (await p.locator('[data-sonner-toast], [role=status]').allInnerTexts().catch(() => [])).join(' | ').replace(/\n/g, ' '); };
const dlg = () => p.locator('[role=alertdialog], [role=dialog]').last();

try {
  for (const name of APPS) {
    for (let i = 0; i < 3; i++) { try { await p.goto(`${BASE}/biz/integrations?demo=owner&lang=ru`, { waitUntil: 'domcontentloaded', timeout: 120000 }); break; } catch { console.log('retry hub'); } }
    await p.waitForTimeout(1200);
    await p.getByLabel('Поиск приложений').fill(name.split(' ')[0]);
    await p.waitForTimeout(1500);
    const tile = p.locator('a[href*="/biz/integrations/apps/"]', { hasText: name }).first();
    if (!(await tile.count())) { console.log('NOT FOUND', name); continue; }
    await tile.click();
    await p.waitForURL(/apps\//, { timeout: 120000 }); await p.waitForTimeout(1500);
    const slug = name.replace(/[^a-zA-Zа-яА-Я0-9]+/g, '_').slice(0, 30);
    // подключить, если не подключено
    const conn = p.getByRole('button', { name: 'Подключить', exact: true });
    if (await conn.count()) {
      await conn.click(); await p.waitForTimeout(700);
      await dlg().getByRole('button', { name: /Подключить/ }).last().click();
      console.log(`${name}: connect →`, await toast());
      await p.waitForTimeout(700);
    }
    const act = p.getByRole('button', { name: 'Партнёр активировал (демо)' });
    if (await act.count()) { await act.click(); console.log(`${name}: activate →`, await toast()); await p.waitForTimeout(800); }
    const st = p.getByRole('tab', { name: 'Настройки' });
    if (!(await st.count())) { console.log(`${name}: NO SETTINGS TAB. side:`, (await text()).slice(0, 200).replace(/\n/g, ' / ')); await p.screenshot({ path: `${OUT}/s-${slug}.png` }); continue; }
    await st.click(); await p.waitForTimeout(900);
    console.log(`\n== ${name} SETTINGS:`, (await text()).replace(/\n/g, ' / ').slice(0, 900));
    await p.screenshot({ path: `${OUT}/s-${slug}.png`, fullPage: true });
    // нажать демо-кнопки и главные действия
    const btns = await p.locator('main button').allInnerTexts();
    const targets = btns.filter((b) => /Демо|демо|Отправить тестов|Пополнить|Запустить|Добавить поток|Скопировать текст|Сохранить|Создать|Добавить/.test(b)).slice(0, 6);
    for (const b of targets) {
      const bt = p.locator('main').getByRole('button', { name: b.trim(), exact: true }).first();
      if (!(await bt.isEnabled().catch(() => false))) { console.log(`   [${b.trim()}] disabled`); continue; }
      await bt.click().catch(() => {});
      await p.waitForTimeout(600);
      const d = await dlg().isVisible().catch(() => false);
      if (d) {
        const dt = (await dlg().innerText()).replace(/\n/g, ' / ').slice(0, 300);
        console.log(`   [${b.trim()}] dialog: ${dt}`);
        const inputs = dlg().locator('input:not([type=checkbox])');
        if (await inputs.count()) await inputs.first().fill(/поток/i.test(b) ? 'G-ABC1234567' : '1000').catch(() => {});
        await dlg().getByRole('button', { name: /Сохранить|Пополнить|Создать|Добавить|Готово|Оплатить/ }).last().click().catch(() => {});
        await p.waitForTimeout(700);
        console.log(`     → ${await toast()}`);
        if (await dlg().isVisible().catch(() => false)) await p.keyboard.press('Escape');
      } else console.log(`   [${b.trim()}] → ${await toast()}`);
    }
    await p.screenshot({ path: `${OUT}/s-${slug}-after.png`, fullPage: true });
  }
  // «Установлено» — сколько
  await p.goto(`${BASE}/biz/integrations/installed?demo=owner&lang=ru`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  console.log('\nINSTALLED:', (await text()).replace(/\n/g, ' / ').slice(0, 1500));
  await p.screenshot({ path: `${OUT}/installed-after-settings.png`, fullPage: true });
} catch (e) {
  console.error('SCRIPT ERROR', e);
} finally {
  console.log('\nERRORS:\n' + [...new Set(errors)].join('\n'));
  await browser.close();
  release();
}
