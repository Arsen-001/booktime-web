// Одноразовый скрипт снятия скриншотов network (dashboard/switch/settings), до/после.
// node scripts/.tmp-shot-network.mjs <tag>
import { chromium } from 'playwright';

const tag = process.argv[2] || 'shot';
const base = 'http://localhost:3710';
const qs = '?demo=owner&sphere=nails';

const targets = [
  { name: 'dashboard', path: '/biz/network' },
  { name: 'switch', path: '/biz/network/switch' },
  { name: 'settings', path: '/biz/network/settings' },
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
      const full = base + t.path + qs;
      let ok = false;
      for (let attempt = 0; attempt < 6 && !ok; attempt++) {
        await page.goto(full, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2200);
        const hasBuildError = await page.locator('text=Build Error').count();
        if (hasBuildError > 0) {
          console.log('build error overlay (other helper mid-edit), retrying', t.path, attempt);
          await page.waitForTimeout(4000);
          continue;
        }
        ok = true;
      }
      const out = `docs/design/after/network-${t.name}-${tag}-${size.name}.png`;
      await page.screenshot({ path: out, fullPage: false });
      console.log('saved', out, ok ? '' : '(WARNING: still had build error)');
    } catch (e) {
      console.error('FAILED', t.path, size.name, e.message);
    }
  }
  await ctx.close();
}
await browser.close();
