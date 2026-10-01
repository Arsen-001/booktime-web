// b04-m0 продолжение: индивидуальная запись → несколько услуг (F-03-089), пакет (F-03-130),
// групповое занятие (F-03-076/101/102), права мастера на онлайн-запись пары «мастер×услуга» (F-03-133 — только чтение UI).
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/online/b04-m0';
async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }

const run = async () => {
  const release = await acquireBrowserSlot();
  try {
    const browser = await chromium.launch();

    // Индивидуальная запись — список услуг, проверяем выбор нескольких + пакет
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(`${BASE}/b/nuri-nail-studio/book?persona=guest&sphere=nails&lang=ru`);
      await page.waitForTimeout(600);
      await page.getByText('Индивидуальная запись').click();
      await page.waitForTimeout(600);
      await shot(page, '09-wizard-services-list');
      const body = await page.textContent('body');
      console.log('[F-03-089] пакет/комплекс в списке услуг присутствует?', /комплекс|пакет|4hands/i.test(body || ''));
      console.log('[F-03-089] есть услуги с ценой и длительностью на списке?', /мин|֏/i.test(body || ''));
      console.log('[wizard services] console errors:', errs);
    }

    // Групповая запись у arman-fit
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      await page.goto(`${BASE}/b/arman-fit/book?persona=guest&sphere=fitness&lang=ru`);
      await page.waitForTimeout(600);
      await shot(page, '10-arman-fit-book-type');
      const body1 = await page.textContent('body');
      const hasGroupOption = /Групповое занятие/i.test(body1 || '');
      console.log('[F-03-076/101] есть выбор «Групповое занятие» на этом бизнесе?', hasGroupOption);
      if (hasGroupOption) {
        await page.getByText('Групповое занятие').click();
        await page.waitForTimeout(700);
        await shot(page, '11-arman-fit-group-list');
        const body2 = await page.textContent('body');
        console.log('[F-03-101] список групповых событий с датой/местами показан?', /мест|участник|свободн/i.test(body2 || ''));
        // F-03-102: "Записаться ещё" на несколько событий — ищем на списке или после записи (не проверяем оплату тут)
      }
      console.log('[group] console errors:', errs);
    }

    await browser.close();
  } finally {
    release();
  }
};

run().catch((e) => { console.error('ОШИБКА:', e.message); process.exit(1); });
