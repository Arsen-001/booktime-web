// Добивка 01.10: finance без [mock-db], журнал 12 ч, вопрос на /new пакета, лист ожидания (желаемое свободно / занято)
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/final-mock/act';
const only = process.argv[2]?.split(',');
const release = await acquireBrowserSlot();
const browser = await chromium.launch({ headless: true });
let lastPage;
async function mk({ device = 'desktop', persona = 'owner' } = {}) {
  const ctx = await browser.newContext(device === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); lastPage = page;
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') warns.push(m.type() + ': ' + m.text().split('\n').slice(0, 4).join(' ').slice(0, 300)); });
  page.on('pageerror', (e) => warns.push('pageerror: ' + String(e).slice(0, 200)));
  const go = async (route) => {
    await page.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}demo=${persona}&empty=0&lang=ru&sphere=nails`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
  };
  return { ctx, page, go, warns, shot: (n) => page.screenshot({ path: `${OUT}/${n}.png` }) };
}
async function step(name, fn) {
  if (only && !only.includes(name)) return;
  try { console.log(`OK   ${name}: ${await fn()}`); }
  catch (e) { await lastPage?.screenshot({ path: `${OUT}/FAIL2-${name}.png` }).catch(() => {}); console.log(`FAIL ${name}: ${String(e).slice(0, 400)}`); }
}

await step('finance', async () => {
  const { ctx, go, warns, page } = await mk();
  await go('/dev/ext/bookingWindow/finance'); await page.waitForTimeout(2000);
  await go('/dev/ext/bookingWindow/loyalty'); await page.waitForTimeout(2000);
  // окно оплаты в журнале: открыть первую запись
  await go('/biz/journal');
  await page.locator('[data-booking-id], button[aria-label*=":"]').first().click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.getByRole('tab', { name: 'Оплата' }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/fin-payment-tab.png` });
  await ctx.close();
  const mock = warns.filter((w) => /mock-db/.test(w));
  if (mock.length) throw new Error(mock.join(' || '));
  return `предупреждений [mock-db] 0; прочие: ${warns.length} ${warns.slice(0, 2).join(' | ')}`;
});

await step('h12', async () => {
  const out = [];
  for (const device of ['desktop', 'phone']) {
    const { ctx, go, page, shot } = await mk({ device });
    await go('/biz/settings/system');
    await page.getByRole('radio', { name: /AM|PM/ }).first().click();
    await page.getByRole('button', { name: /^Сохранить/ }).last().click();
    await page.waitForTimeout(1200);
    await go('/biz/journal'); await page.waitForTimeout(2000);
    await shot(`h12b-journal-${device}`);
    // перенос времени: высота подписи оси = одна строка
    const axis = await page.evaluate(() => [...document.querySelectorAll('span')].filter((s) => /^\d{1,2}(:\d{2})?(AM|PM)$/.test(s.textContent?.replace(/\s/g, '') ?? '') && s.className.includes('text-muted')).map((s) => s.getBoundingClientRect().height));
    out.push(`${device}: подписей оси ${axis.length}, макс. высота ${Math.max(0, ...axis).toFixed(0)}px`);
    await ctx.close();
  }
  return out.join('; ');
});

await step('pkgnew', async () => {
  const { ctx, go, page, shot } = await mk();
  await go('/biz/resources/packages/new');
  await page.locator('main input').first().fill('Пакет черновик');
  await page.locator('a[href="/biz/resources/packages"]').first().click();
  const dlg = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await dlg.first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await shot('pkgnew-unsaved');
  await page.getByRole('button', { name: /Остаться/ }).click();
  await page.waitForTimeout(300);
  if (!page.url().includes('/new')) throw new Error('ушли после «Остаться»');
  await page.getByRole('button', { name: /^Отмена$/ }).click();
  await dlg.first().waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: /^Уйти$/ }).click();
  await page.waitForURL(/packages$|packages\?/, { timeout: 10000 });
  // пустая форма — без вопроса
  await go('/biz/resources/packages/new');
  await page.locator('a[href="/biz/resources/packages"]').first().click();
  await page.waitForURL(/packages(\?|$)/, { timeout: 10000 });
  await ctx.close();
  return 'ссылка «Назад» и «Отмена» спрашивают; «Остаться» держит, «Уйти» уводит; пустая форма уходит без вопроса';
});

await step('waitlist', async () => {
  const { ctx, go, page, shot } = await mk();
  const toastText = async () => (await page.locator('[role="status"], [data-sonner-toast], li[data-type]').allInnerTexts().catch(() => [])).join(' ').replace(/\s+/g, ' ');
  // A: заявка Анны — 03.10 18:00 (занято) или 05.10 10–12 / 16–18 → окно на желаемом интервале, без подсказки
  await go('/biz/waitlist');
  await page.getByText('Маникюр с покрытием гель-лаком').first().click();
  await page.getByRole('button', { name: /^Записать$/ }).first().click();
  await page.waitForURL(/waitlist=/, { timeout: 30000 });
  const urlA = new URL(page.url()).searchParams;
  await page.waitForTimeout(1200);
  const toastA = await toastText();
  await shot('wl2-A-window');
  await page.getByRole('button', { name: /^Записать$/ }).last().click();
  await page.waitForTimeout(2500);
  const a = `A: ${urlA.get('date')} ${urlA.get('start')} мастер ${urlA.get('staff')}; подсказка: ${/занято/.test(toastA) ? 'есть' : 'нет'}`;
  // B: та же заявка снова активна, желание — ровно только что занятое время → ближайшее свободное + подсказка
  const busyDate = urlA.get('date'), busyTime = urlA.get('start');
  const edited = await page.evaluate(({ busyDate, busyTime }) => {
    const key = Object.keys(localStorage).find((k) => k.endsWith(':area:resources'));
    if (!key) return 'нет ключа';
    const raw = JSON.parse(localStorage.getItem(key));
    const holder = raw.state ?? raw;
    const list = holder.waitlist ?? holder.data?.waitlist;
    const e = list?.find((w) => w.id === 'wl_nuri_1');
    if (!e) return 'нет заявки ' + Object.keys(holder).slice(0, 10).join(',');
    delete e.closedBookingId;
    e.wishes = [{ date: busyDate, time: busyTime }];
    localStorage.setItem(key, JSON.stringify(raw));
    return 'ok';
  }, { busyDate, busyTime });
  if (edited !== 'ok') throw new Error(a + '; правка хранилища: ' + edited);
  await go('/biz/waitlist');
  await page.getByText('Маникюр с покрытием гель-лаком').first().click();
  await page.getByRole('button', { name: /^Записать$/ }).first().click();
  await page.waitForURL(/waitlist=/, { timeout: 30000 });
  const urlB = new URL(page.url()).searchParams;
  await page.waitForTimeout(800);
  const toastB = await toastText();
  await shot('wl2-B-window');
  // C: желание — точное свободное время не первым слотом дня (05.10 12:00; у Ани 10:00–15:00 пусто) → окно ровно на нём
  await go('/biz/waitlist');
  const editedC = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.endsWith(':area:resources'));
    const raw = JSON.parse(localStorage.getItem(key));
    const e = (raw.state ?? raw).waitlist.find((w) => w.id === 'wl_nuri_1');
    e.wishes = [{ date: '2026-10-05', time: '12:00' }];
    localStorage.setItem(key, JSON.stringify(raw));
    return 'ok';
  });
  await go('/biz/waitlist');
  await page.getByText('Маникюр с покрытием гель-лаком').first().click();
  await page.getByRole('button', { name: /^Записать$/ }).first().click();
  await page.waitForURL(/waitlist=/, { timeout: 30000 });
  const urlC = new URL(page.url()).searchParams;
  await page.waitForTimeout(1500);
  const toastC = await toastText();
  await shot('wl2-C-window');
  await page.getByRole('button', { name: /^Записать$/ }).last().click();
  await page.waitForTimeout(2500);
  await go('/biz/waitlist');
  const closedC = Number((await page.locator('main').innerText()).match(/Закрытая\s*(\d+)/)?.[1] ?? 0);
  await shot('wl2-C-after');
  await ctx.close();
  const c = `C (желание 2026-10-05 12:00 свободно, ${editedC}): окно ${urlC.get('date')} ${urlC.get('start')}; подсказка: ${/занято/.test(toastC) ? 'есть' : 'нет'}; закрытых после записи ${closedC}`;
  if (urlC.get('date') !== '2026-10-05' || urlC.get('start') !== '12:00' || /занято/.test(toastC)) throw new Error(a + '; ' + c);
  const b = `B (желание ${busyDate} ${busyTime} занято): окно ${urlB.get('date')} ${urlB.get('start')} мастер ${urlB.get('staff')}; тост: «${toastB.slice(0, 80)}»`;
  if (!/занято/.test(toastB) || (urlB.get('date') === busyDate && urlB.get('start') === busyTime)) throw new Error(a + '; ' + b);
  return a + '; ' + b + '; ' + c;
});

await step('phonecards', async () => {
  const out = [];
  for (const h of ['24', '12']) {
    const { ctx, go, page, shot } = await mk({ device: 'phone' });
    if (h === '12') {
      await go('/biz/settings/system');
      await page.getByRole('radio', { name: /AM|PM/ }).first().click();
      await page.getByRole('button', { name: /^Сохранить/ }).last().click();
      await page.waitForTimeout(1200);
    }
    await go('/biz/journal'); await page.waitForTimeout(2000);
    await shot(`phonecards-${h}-top`);
    // прокрутить сетку к дневным записям и снять ещё
    await page.evaluate(() => { const sc = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 200 && getComputedStyle(e).overflowY !== 'visible'); if (sc) sc.scrollTop += 500; });
    await page.waitForTimeout(600);
    await shot(`phonecards-${h}-mid`);
    const info = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-f~="F-01-128"]')].map((n) => n.closest('button') ?? n.parentElement);
      return cards.map((c) => ({ h: Math.round(c.getBoundingClientRect().height), name: c.querySelector('[data-f~="F-01-128"]')?.textContent, nameW: Math.round(c.querySelector('[data-f~="F-01-128"]')?.getBoundingClientRect().width ?? 0) })).filter((x) => x.h > 0 && x.h < 76);
    });
    out.push(`${h}ч: коротких ${info.length}, имена: ${info.slice(0, 5).map((x) => `${x.name}(${x.nameW}px,h${x.h})`).join(', ')}`);
    await ctx.close();
  }
  return out.join(' || ');
});

await browser.close(); release();
