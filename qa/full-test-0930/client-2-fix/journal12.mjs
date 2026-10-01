import { start, newPage, go, text } from '../client-2/h.mjs';
const { browser, done } = await start();
try {
  const { page, errors } = await newPage(browser, { device: 'desktop' });
  await go(page, '/biz/journal', 'owner');
  const found = await page.evaluate(() => {
    const k = 'bp-mock-db:area:journal';
    const raw = localStorage.getItem(k);
    if (!raw) return Object.keys(localStorage).filter((x) => x.includes('journal'));
    const j = JSON.parse(raw);
    const st = j.state ?? j;
    st.settings = { ...(st.settings ?? {}), hourFormat: '12' };
    localStorage.setItem(k, JSON.stringify(j));
    return ['ok', Object.keys(st).slice(0, 5)];
  });
  console.log('keys', found);
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000);
  const t = await text(page);
  console.log('journal times:', (t.match(/\d{1,2}:\d{2}\s?(AM|PM|вечера|утра|дня)/g) ?? []).slice(0, 6).join(', '), '| вечера:', /\d:\d\d (вечера|утра|дня|ночи)/.test(t));
  await page.screenshot({ path: '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2-fix/r2-journal-12h-desktop.png' });
  console.log(errors.slice(0, 3));
} finally { await done(); }
