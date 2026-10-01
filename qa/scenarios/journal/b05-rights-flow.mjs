// Пачка b05: сквозной сценарий владелец→снять права у мастера→мастер видит ограничения.
// node qa/scenarios/journal/b05-rights-flow.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const OUT = 'qa/shots/journal/b05-rights-flow';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const b = await chromium.launch();

const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
const p = await c.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR', m.text().slice(0, 200)); });

const shot = async (p, name) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

// ── Фаза 1: владелец снимает права у Ани Саргсян (мастер) — ОДИН и тот же context/localStorage дальше ──
{
  await p.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(() => {});
  const root = p.locator('[data-f~="F-01-178"][data-f~="F-01-179"]').first();
  await root.scrollIntoViewIfNeeded();
  const staffSelect = root.locator('select').first();
  await staffSelect.selectOption({ label: 'Ани Саргсян' }).catch(async () => {
    const opts = await staffSelect.locator('option').allTextContents();
    console.log('STAFF OPTIONS', opts);
  });
  await p.waitForTimeout(600);
  await shot(p, '01-owner-rights-journal-before');

  // Journal-блок: выключить "Показывать номера телефонов", "Перенос записи"; historyLimit → 7 дней
  const journalTab = root.locator('button:has-text("Журнал")').first();
  await journalTab.click().catch(() => {});
  await p.waitForTimeout(300);
  const toggleByLabel = async (label) => {
    const sw = root.locator(`label:has-text("${label}")`).first();
    await sw.click({ timeout: 5000 }).catch((e) => console.log('toggle fail', label, e.message));
    await p.waitForTimeout(400);
  };
  await toggleByLabel('Показывать номера телефонов');
  await toggleByLabel('Перенос записи');
  const historySelect = root.locator('select').nth(1);
  await historySelect.selectOption({ index: 3 }).catch((e) => console.log('history select fail', e.message)); // ~7 дней
  await p.waitForTimeout(400);
  await shot(p, '02-owner-rights-journal-after');

  // Окно записи: выключить "Показывать номера телефонов" в группе "Клиент"
  const windowTab = root.locator('button:has-text("Окно записи")').first();
  await windowTab.click();
  await p.waitForTimeout(300);
  await shot(p, '03-owner-rights-window-before');
  const clientPhoneSwitch = root.locator('label:has-text("Показывать номера телефонов")').first();
  await clientPhoneSwitch.click({ timeout: 5000 }).catch((e) => console.log('window phone toggle fail', e.message));
  await p.waitForTimeout(400);
  await shot(p, '04-owner-rights-window-after');
}

// ── Фаза 2: мастер (Ани Саргсян) видит журнал с урезанными правами (та же вкладка/сторедж) ──
{
  await p.goto(`${BASE}/biz/journal?demo=master&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(() => {});
  await p.waitForTimeout(800);
  await shot(p, '05-master-journal');

  // Открыть первую запись в окне и проверить маску телефона
  const block = p.locator('[data-f~="F-01-026"]').first();
  await block.click({ timeout: 8000 }).catch((e) => console.log('open booking fail', e.message));
  await p.waitForTimeout(600);
  await p.locator('button:has-text("Клиент")').first().click({ timeout: 5000 }).catch((e) => console.log('client tab fail', e.message));
  await p.waitForTimeout(400);
  await shot(p, '06-master-booking-window');
  const phoneField = p.locator('[data-f~="F-01-179"] input, [data-f~="F-01-063"] input').first();
  const phoneVal = await phoneField.inputValue().catch(() => null);
  console.log('PHONE FIELD VALUE (master, showPhones off):', phoneVal);
  const bodyText = await p.locator('body').innerText();
  console.log('HAS XXXXX MASK:', /X{3,}/.test(bodyText));
  await p.locator('[aria-label="Закрыть"], button:has(svg)').first(); // noop, close via Escape below
  await p.keyboard.press('Escape').catch(() => {});
}

// ── Фаза 3: перенос в сетке через drag — мастер, reschedule=off (тот же контекст) ──
{
  await p.goto(`${BASE}/biz/journal?demo=master&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(() => {});
  await p.waitForTimeout(600);
  const block = p.locator('[data-f~="F-01-031"]').first();
  const cursor = await block.evaluate((el) => getComputedStyle(el).cursor).catch(() => 'n/a');
  console.log('CURSOR before drag:', cursor);
  const box = await block.boundingBox();
  if (box) {
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height + 90, { steps: 10 });
    await p.mouse.up();
    await p.waitForTimeout(500);
  } else {
    console.log('no draggable block found for F-01-031');
  }
  await shot(p, '07-master-after-drag-attempt');
}

await c.close();
await b.close();
release();
console.log('done');
