// Одноразовый скрипт для снятия скриншотов раздела resources (до/после редизайна).
// node scripts/.tmp-shot-resources.mjs <tag>   -> сохраняет docs/design/after/resources-<name>-<tag>-<size>.png
import { chromium } from 'playwright';

const tag = process.argv[2] || 'shot';
const base = 'http://localhost:3710';
const qsNails = '?demo=owner&sphere=nails';
const qsGeneral = '?demo=individual&sphere=fitness';

const targets = [
  { name: 'rooms', path: '/biz/resources', qs: qsNails },
  { name: 'events', path: '/biz/groups', qs: qsGeneral },
  { name: 'waitlist', path: '/biz/waitlist', qs: qsNails },
];

const sizes = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];

const browser = await chromium.launch();
for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  const page = await ctx.newPage();
  for (const t of targets) {
    try {
      const full = base + t.path + t.qs;
      try {
        await page.goto(full, { waitUntil: 'networkidle', timeout: 20000 });
      } catch {
        await page.goto(full, { waitUntil: 'load', timeout: 20000 });
      }
      await page.waitForTimeout(700);
      const out = `docs/design/after/resources-${t.name}-${tag}-${size.name}.png`;
      await page.screenshot({ path: out, fullPage: false });
      console.log('saved', out);
    } catch (e) {
      console.error('FAILED', t.path, size.name, e.message);
    }
  }
  await ctx.close();
}
await browser.close();
