// Глубокий прогон b06: черновик заявки на своё приложение → заполнение → отправка → перезагрузка → права.
// node qa/scenarios/client/b06-flow.mjs
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'qa/shots/client/b06-m1');
const BASE = 'http://localhost:3710';

function url(p) {
  return `${BASE}${p}?demo=owner&sphere=barber&lang=ru&theme=light`;
}

async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    let stage = 'init';
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${stage}] ` + m.text().slice(0, 200)); });
    page.on('pageerror', (e) => consoleErrors.push(`[${stage}] pageerror: ` + e.message.slice(0, 200)));

    await page.goto(url('/biz/apps/branded'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // 1. Черновик пуст — кнопка «Заявку заблокировали» видна (или submit disabled), поля материалов пусты
    const submitBtn = page.getByRole('button', { name: /Отправить заявку/i });
    await submitBtn.waitFor({ state: 'visible', timeout: 8000 });
    const disabledBefore = await submitBtn.isDisabled();
    await page.screenshot({ path: path.join(OUT, 'flow-01-draft-empty.png'), fullPage: true });

    // 2. Заполняем текстовые поля
    stage = 'fill-text';
    await page.getByLabel(/Полное название/i).fill('Barber Shop Studio');
    await page.getByLabel(/Короткое название/i).fill('BarberApp');
    const shortDesc = page.locator('textarea, input').filter({ hasText: '' });
    // Найдём поля по FormField label через getByLabel — короткое и длинное описания
    await page.getByLabel(/Короткое описание/i).fill('Запись к барберу в один тап.');
    await page.getByLabel(/Длинное описание/i).fill('Записывайтесь к барберу в пару нажатий и следите за визитами в приложении.');
    await page.getByLabel(/Ключевые слова/i).fill('барбер, стрижка, борода');

    // 3. Загружаем изображения (заставка 2208×2208, логотип 1024×1024, featured 1024×500) — настоящие PNG
    const fs = await import('node:fs');
    const bigPng = fs.readFileSync('/tmp/logo2208.png'); // 2208×2208, проходит и как заставка, и (с запасом) как логотип
    const featuredPng = fs.readFileSync('/tmp/featured.png'); // 1024×500
    const fileInputs = page.locator('input[type="file"]');
    const count = await fileInputs.count();
    stage = 'upload';
    for (let i = 0; i < count; i++) {
      const buf = i === 2 ? featuredPng : bigPng; // порядок в разметке: splash, logo, featured
      await fileInputs.nth(i).setInputFiles({ name: 'material.png', mimeType: 'image/png', buffer: buf }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'flow-02-materials-filled.png'), fullPage: true });

    // 4. Документы — отмечаем все 4 чекбокса
    const checkboxes = page.getByRole('checkbox');
    const cbCount = await checkboxes.count();
    stage = 'checkboxes';
    for (let i = 0; i < cbCount; i++) {
      const cb = checkboxes.nth(i);
      if (!(await cb.isChecked())) await cb.click();
      await page.waitForTimeout(150);
    }

    // 5. Тип владельца и способ доступа
    stage = 'owner-access';
    await page.getByText('Организация', { exact: false }).first().click().catch(() => {});
    await page.getByText('Приглашение в портал', { exact: false }).first().click().catch(() => {});

    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'flow-03-docs-owner-filled.png'), fullPage: true });

    // 6. Доп. филиал — проверяем пересчёт цены
    const plusBtn = page.getByRole('button', { name: '+' });
    const totalBefore = await page.locator('text=Итого за год').locator('..').innerText().catch(() => '');
    stage = 'extra-location';
    await plusBtn.click();
    await page.waitForTimeout(500);
    const totalAfter = await page.locator('text=Итого за год').locator('..').innerText().catch(() => '');

    // 7. Проверяем состояние кнопки «Отправить заявку»
    const disabledAfter = await submitBtn.isDisabled();
    await page.screenshot({ path: path.join(OUT, 'flow-04-before-submit.png'), fullPage: true });

    let submitClicked = false;
    let submitToast = false;
    stage = 'submit';
    if (!disabledAfter) {
      await submitBtn.click();
      submitClicked = true;
      await page.waitForTimeout(1000);
      submitToast = await page.getByText(/отправлена/i).first().isVisible().catch(() => false);
      await page.screenshot({ path: path.join(OUT, 'flow-05-after-submit.png'), fullPage: true });
    }

    // 8. Перезагрузка — материалы должны сохраниться
    stage = 'reload';
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const fullNameAfterReload = await page.getByLabel(/Полное название/i).inputValue().catch(() => '(не найдено)');
    await page.screenshot({ path: path.join(OUT, 'flow-06-after-reload.png'), fullPage: true });

    // 9. Права: другая персона (client) не должна видеть кабинет бизнеса вовсе
    const page2 = await ctx.newPage();
    let clientBlocked = 'не проверено';
    try {
      const resp = await page2.goto(`${BASE}/biz/apps/branded?demo=client&sphere=barber&lang=ru`, { waitUntil: 'networkidle', timeout: 15000 });
      await page2.waitForTimeout(500);
      const bodyText = await page2.innerText('body').catch(() => '');
      clientBlocked = resp?.status() + ' / ' + (bodyText.slice(0, 200).replace(/\s+/g, ' '));
      await page2.screenshot({ path: path.join(OUT, 'flow-07-client-persona-on-biz-route.png'), fullPage: true });
    } catch (e) {
      clientBlocked = 'ошибка: ' + e.message;
    }

    console.log(JSON.stringify({
      disabledBefore,
      disabledAfter,
      submitClicked,
      submitToast,
      totalBefore: totalBefore.replace(/\s+/g, ' '),
      totalAfter: totalAfter.replace(/\s+/g, ' '),
      fullNameAfterReload,
      clientBlocked,
      consoleErrors,
    }, null, 2));

    await ctx.close();
  } finally {
    await browser.close();
    release();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
