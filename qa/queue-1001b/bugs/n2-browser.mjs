// №2 в браузере: /search?q=стрижка → карточки про стрижку, «Укладки» нет; переход на мастера — окна под найденную услугу
// MODE=api — против копии сервера :4023 (вход клиента не нужен: каталог публичный)
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001b/bugs';
const MODE = process.env.MODE ?? 'mock';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const [device, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    await ctx.route('http://localhost:4010/**', (r) => r.continue({ url: r.request().url().replace(':4010', ':4023') }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 200)));
    await page.goto(`http://localhost:3710/search?q=${encodeURIComponent('стрижка')}&demo=client&data=${MODE}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForTimeout(8000);
    const body = await page.locator('main').innerText();
    console.log(`${MODE} ${device}: «Укладка» в выдаче: ${/Укладка/.test(body)}; строки услуг:`, [...body.matchAll(/^.*(стрижк|Укладк).*$/gim)].slice(0, 5).map((m) => m[0].trim()).join(' | '));
    await page.screenshot({ path: `${OUT}/${MODE === 'api' ? 'api-' : ''}n2-search-${device}.png` });
    const link = page.locator('main a[href^="/masters/"]').nth(1);
    console.log('  ссылка мастера:', await link.getAttribute('href'));
    await link.click();
    await page.waitForTimeout(6000);
    console.log('  карточка:', ((await page.locator('main').innerText()).match(/Свободное время для услуги[^\n]*\n?[^\n]*/) ?? ['—'])[0].replace(/\n/g, ' '));
    await page.screenshot({ path: `${OUT}/${MODE === 'api' ? 'api-' : ''}n2-master-${device}.png` });
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
