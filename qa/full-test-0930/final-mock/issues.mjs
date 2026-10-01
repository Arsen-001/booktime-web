// Открыть страницу и прочитать «N Issues» оверлея Next (что именно он считает)
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch({ headless: true });
const [route, persona = 'owner', device = 'desktop'] = process.argv.slice(2);
const ctx = await browser.newContext(device === 'phone' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const all = [];
page.on('console', (m) => all.push(m.type() + ': ' + m.text().slice(0, 600)));
page.on('pageerror', (e) => all.push('pageerror: ' + e));
await page.goto(`http://localhost:3710${route}${route.includes('?') ? '&' : '?'}demo=${persona.replace('-empty','')}&empty=${persona.endsWith('-empty') ? 1 : 0}&lang=ru`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(4000);
const badge = await page.evaluate(() => {
  const host = document.querySelector('nextjs-portal');
  const root = host?.shadowRoot;
  if (!root) return 'no portal';
  const els = [...root.querySelectorAll('button, [data-issues], span')].filter((e) => /Issue/.test(e.textContent || '') && !e.closest('style'));
  return els.map((e) => (e.textContent || '').trim()).slice(0, 3).join(' || ');
});
console.log('OVERLAY:', badge);
try {
  await page.locator('nextjs-portal').getByText(/\d+ Issues?/).first().click({ timeout: 3000 });
  await page.waitForTimeout(1500);
  const txt = await page.evaluate(() => { const r = document.querySelector('nextjs-portal')?.shadowRoot; const d = r?.querySelector('[role="dialog"], dialog, [data-nextjs-dialog]'); return (d?.innerText ?? 'no dialog').replace(/\s+/g, ' ').slice(0, 3000); });
  console.log('ISSUES:', txt);
  await page.screenshot({ path: `/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/final-mock/act/issues-${route.replace(/[^a-z0-9]+/gi, '-')}-${persona}.png` });
} catch (e) { console.log('no issues badge', String(e).slice(0, 100)); }
console.log(all.filter((x) => !x.startsWith('log:') && !x.startsWith('info:') && !x.startsWith('debug:')).join('\n'));
await browser.close(); release();
