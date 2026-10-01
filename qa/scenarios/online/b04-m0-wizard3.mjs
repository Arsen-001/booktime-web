import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/online/b04-m0';
async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }

const run = async () => {
  const release = await acquireBrowserSlot();
  try {
    const browser = await chromium.launch();

    // Индивидуальная запись: мастер → услуги (реальный порядок шагов)
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/b/nuri-nail-studio/book?persona=guest&sphere=nails&lang=ru`);
      await page.waitForTimeout(600);
      await page.getByText('Индивидуальная запись').click();
      await page.waitForTimeout(600);
      await page.getByText('Мариам Петросян').click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Продолжить/ }).click();
      await page.waitForTimeout(700);
      await shot(page, '12-wizard-real-services');
      const body = await page.textContent('body');
      console.log('[F-03-089] на шаге услуг видно поле с ценой/минутами (услуги реально перечислены)?', /мин\b/i.test(body || ''));
      console.log('[F-03-130] пакет/комплекс среди услуг мастера?', /комплекс|пакет/i.test(body || ''));
    }

    // Групповое занятие у arman-fit — с бОльшим ожиданием
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/b/arman-fit/book?persona=guest&sphere=fitness&lang=ru`);
      await page.waitForTimeout(700);
      await page.getByText('Групповое занятие').click();
      await page.waitForTimeout(1500);
      await shot(page, '13-arman-fit-group-list-v2');
      const body = await page.textContent('body');
      console.log('[F-03-101] контент группового списка появился (не завис скелетон)?', body && body.trim().length > 0);
      console.log('[F-03-101] текст про места/участников?', /мест|участник|свободн|записаться/i.test(body || ''));
    }

    await browser.close();
  } finally { release(); }
};

run().catch((e) => { console.error('ОШИБКА:', e.message); process.exit(1); });
