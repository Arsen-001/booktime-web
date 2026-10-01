// Снимки состояний журнала: неделя, месяц, «⋯ Ещё», «Все мастера», дата, окно записи.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const out = process.argv[2] ?? 'qa/journal-redesign/i';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.clock.setFixedTime(new Date('2026-09-26T13:20:00+04:00'));
  await page.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 60000 });
  const shot = async (n) => { await page.waitForTimeout(700); await page.screenshot({ path: `${out}-${n}.png` }); };
  await page.getByRole('button', { name: /Все мастера/ }).click();
  await shot('masters');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Суббота, 26 сентября/ }).click();
  await shot('date');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ещё' }).click();
  await shot('more');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.locator('[data-testid="booking-block"]').first().click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}-open-mid.png` });
  await shot('open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await page.getByRole('radio', { name: 'Неделя' }).click();
  await shot('week');
  await page.getByRole('radio', { name: 'Месяц' }).click();
  await shot('month');
  console.log('errors:', errs.slice(0, 8).join('\n'));
} finally {
  await browser.close();
  release();
}
