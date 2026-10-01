import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/stock-b01/flows';
fs.mkdirSync(OUT, { recursive: true });

async function step(name, fn) {
  try {
    await fn();
    console.log('ok:', name);
  } catch (e) {
    console.log('FAIL:', name, '—', e.message.split('\n')[0]);
  }
}

async function run() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(8000);
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

    await step('add-product-form', async () => {
      await page.goto(`${BASE}/biz/stock?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: 'Добавить товар' }).first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/01-add-product-form.png`, fullPage: true });
    });

    await step('add-product-filled', async () => {
      const nameInput = page.locator('input[name="name"], input#name, input[id*="name" i]').first();
      if (await nameInput.count()) await nameInput.fill('QA тестовый товар');
      const priceInput = page.locator('input[name*="price" i], input[id*="price" i]').first();
      if (await priceInput.count()) await priceInput.fill('1000');
      await page.screenshot({ path: `${OUT}/02-add-product-filled.png`, fullPage: true });
      const saveBtn = page.getByRole('button', { name: /Сохранить/ }).first();
      if (await saveBtn.count()) {
        await saveBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/02b-after-save.png`, fullPage: true });
      }
    });

    await step('add-category', async () => {
      await page.goto(`${BASE}/biz/stock?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      const addCat = page.getByText('Добавить категорию').first();
      await addCat.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/03-add-category.png`, fullPage: true });
    });

    await step('search', async () => {
      await page.goto(`${BASE}/biz/stock?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      const search = page.locator('input[placeholder*="Название"]').last();
      await search.fill('гель');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/04-search.png`, fullPage: true });
    });

    await step('search-barcode', async () => {
      const search = page.locator('input[placeholder*="Название"]').last();
      await search.fill('300123456789');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/04b-search-barcode.png`, fullPage: true });
    });

    await step('product-card', async () => {
      await page.goto(`${BASE}/biz/stock?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.getByText('Топовое покрытие').first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/05-product-card.png`, fullPage: true });
    });

    await step('add-warehouse', async () => {
      await page.goto(`${BASE}/biz/stock/warehouses?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: 'Добавить склад' }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/06-add-warehouse.png`, fullPage: true });
    });

    await step('warehouse-edit', async () => {
      await page.goto(`${BASE}/biz/stock/warehouses?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.getByText('Расходники', { exact: true }).first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/07-warehouse-edit.png`, fullPage: true });
    });

    await step('operations-menu', async () => {
      await page.goto(`${BASE}/biz/stock/operations?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Операции с товарами/ }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/08-operations-menu.png`, fullPage: true });
    });

    await step('operations-filters', async () => {
      const typeSelect = page.getByRole('button', { name: 'Все типы операций' });
      if (await typeSelect.count()) {
        await typeSelect.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/08b-operations-filter-type.png`, fullPage: true });
      }
    });

    await step('add-equipment', async () => {
      await page.goto(`${BASE}/biz/stock/equipment?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: 'Добавить оборудование' }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/09-add-equipment.png`, fullPage: true });
    });

    await step('help-icon', async () => {
      await page.goto(`${BASE}/biz/stock?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      const helpBtn = page.locator('[aria-label*="омощь" i], [aria-label*="help" i], [title*="омощь" i]').first();
      const n = await helpBtn.count();
      console.log('help buttons found:', n);
      if (n) {
        await helpBtn.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/10-help.png`, fullPage: true });
      }
    });

    await step('empty-owner', async () => {
      await page.goto(`${BASE}/biz/stock?demo=owner&empty=1&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/11-empty-owner.png`, fullPage: true });
    });

    await step('empty-warehouses', async () => {
      await page.goto(`${BASE}/biz/stock/warehouses?demo=owner&empty=1&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/11b-empty-warehouses.png`, fullPage: true });
    });

    await step('empty-operations', async () => {
      await page.goto(`${BASE}/biz/stock/operations?demo=owner&empty=1&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/11c-empty-operations.png`, fullPage: true });
    });

    await step('empty-equipment', async () => {
      await page.goto(`${BASE}/biz/stock/equipment?demo=owner&empty=1&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/11d-empty-equipment.png`, fullPage: true });
    });

    await step('dental-sphere', async () => {
      await page.goto(`${BASE}/biz/stock?demo=owner&sphere=dental&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/12-dental-sphere.png`, fullPage: true });
    });

    await step('master-persona', async () => {
      await page.goto(`${BASE}/biz/stock?demo=master&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/13-master-persona.png`, fullPage: true });
    });

    await step('phone-catalog', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE}/biz/stock?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/14-phone-catalog.png`, fullPage: true });
    });

    await step('phone-add-product', async () => {
      await page.getByRole('link', { name: 'Добавить товар' }).first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/15-phone-add-product.png`, fullPage: true });
    });

    fs.writeFileSync(`${OUT}/console-errors.json`, JSON.stringify(consoleErrors, null, 2));
    console.log('consoleErrors:', consoleErrors.length);
    console.log(JSON.stringify(consoleErrors, null, 2));
  } finally {
    await browser.close();
    release();
  }
}

run();
