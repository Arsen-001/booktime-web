// Замер плавности журнала A2 (DESIGN.md → Performance): Playwright + CDP CPU×4, кадры считаются requestAnimationFrame.
//   node qa/journal-redesign/perf.mjs [base=http://localhost:3799] [cards=64]
// Сценарии: прокрутка сетки, День → Неделя → День ×5, открыть/закрыть окно записи ×5.
// Нагрузка: в чистом контексте браузера записи дня подменяются на N синтетических (копии настоящих: те же мастера,
// клиенты, услуги) — ключ bp-mock-db:core:bookings; живые данные никого не трогаются (свой контекст).
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const base = process.argv[2] ?? 'http://localhost:3799';
const target = Number(process.argv[3] ?? 64);
const url = `${base}/biz/journal?demo=owner&sphere=nails&lang=ru`;

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 90000 });

  // ── 1. Синтетический плотный день из настоящих записей (через пропсы DayGrid в дереве React)
  const made = await page.evaluate((target) => {
    const el = document.querySelector('[data-testid="booking-block"]');
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    let f = el[key];
    while (f && !(f.memoizedProps && f.memoizedProps.bookingsByColumn && f.memoizedProps.columns)) f = f.return;
    if (!f) return 0;
    const { columns, bookingsByColumn, date } = f.memoizedProps;
    const all = Object.values(bookingsByColumn).flat();
    const tpl = all[0];
    const staffCols = columns.filter((c) => c.kind === 'staff' && c.hours.length);
    const statuses = ['scheduled', 'client_confirmed', 'arrived', 'awaiting_confirmation', 'scheduled'];
    const out = [];
    const perStaff = Math.ceil(target / staffCols.length);
    staffCols.forEach((c, ci) => {
      const [fh, fm] = c.hours[0].from.split(':').map(Number);
      let m = fh * 60 + fm;
      for (let i = 0; i < perStaff && out.length < target; i++) {
        const src = all[(ci * perStaff + i) % all.length];
        const dur = [30, 45, 60, 30][i % 4];
        const hh = String(Math.floor(m / 60) % 24).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        out.push({
          ...src,
          id: `perf_${ci}_${i}`,
          staffId: c.staff.id,
          start: `${date}T${hh}:${mm}`,
          durationMin: dur,
          status: statuses[(ci + i) % statuses.length],
          services: src.services.map((l) => ({ ...l, staffId: c.staff.id })),
          businessId: tpl.businessId,
          locationId: tpl.locationId,
          groupEventId: undefined,
          deletedAt: undefined,
        });
        m += dur;
      }
    });
    localStorage.setItem('bp-mock-db:core:bookings', JSON.stringify(out));
    return out.length;
  }, target);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-testid="booking-block"]').first().waitFor({ timeout: 90000 });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(1500);
  const cards = await page.locator('[data-testid="booking-block"]').count();

  // ── 2. CPU ×4 и счётчик кадров
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__frames = [];
    const loop = (t) => {
      window.__frames.push(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const mark = () => page.evaluate(() => window.__frames.length);
  const stats = (from, to) =>
    page.evaluate(
      ([a, b]) => {
        const fr = window.__frames.slice(a, b);
        const d = fr.slice(1).map((x, i) => x - fr[i]);
        const total = fr[fr.length - 1] - fr[0];
        return { frames: fr.length, ms: Math.round(total), fps: +((d.length * 1000) / total).toFixed(1), maxFrame: +Math.max(...d).toFixed(1), over32: d.filter((x) => x > 32).length };
      },
      [from, to],
    );
  const results = {};

  // Прокрутка сетки колесом: вниз и обратно
  const grid = page.locator('[data-f~="F-01-018"]').first();
  const box = await grid.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  let a = await mark();
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(400);
  results.scroll = await stats(a, await mark());

  // День → Неделя → День ×5
  a = await mark();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('radio', { name: 'Неделя' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('radio', { name: 'День' }).click();
    await page.locator('[data-testid="booking-block"]').first().waitFor();
    await page.waitForTimeout(700);
  }
  results.dayWeekDay = await stats(a, await mark());

  // Следующий/предыдущий день ×5 (листание дней)
  a = await mark();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Следующий день' }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Предыдущий день' }).click();
    await page.waitForTimeout(600);
  }
  results.switchDays = await stats(a, await mark());

  // Открыть/закрыть окно записи ×5 (общий элемент карточка → окно)
  a = await mark();
  for (let i = 0; i < 5; i++) {
    await page.locator('[data-testid="booking-block"]').nth(i * 3).click();
    await page.waitForTimeout(900);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
  }
  results.openCloseWindow = await stats(a, await mark());

  const all = Object.values(results);
  const avgFps = +(all.reduce((s, r) => s + r.fps, 0) / all.length).toFixed(1);
  const maxFrame = Math.max(...all.map((r) => r.maxFrame));
  console.log(JSON.stringify({ base, syntheticBookings: made, cardsOnScreen: cards, results, avgFps, maxFrame, errors: errors.slice(0, 5) }, null, 2));
} finally {
  await browser.close();
  release();
}
