import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs=[]; page.on('console', m => { if (m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text().slice(0,400)); });
const O='/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/final-mock/act';
for (const r of process.argv.slice(2)) {
  errs.length=0;
  await page.goto('http://localhost:3710'+r+(r.includes('?')?'&':'?')+'demo=owner&empty=0&lang=ru', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForLoadState('networkidle', {timeout: 20000}).catch(()=>{});
  await page.waitForTimeout(2500);
  const slug = r.replace(/[^a-z0-9]+/gi,'-');
  await page.screenshot({ path: `${O}/probe${slug}.png` });
  console.log('=== '+r);
  console.log(errs.join('\n'));
  console.log((await page.locator('main').innerText().catch(()=>'')).slice(0,1500));
  console.log('labels:', await page.locator('label').allInnerTexts().then(a=>a.slice(0,30).join(' | ')));
  console.log('links:', await page.locator('main a[href]').evaluateAll(as=>as.slice(0,15).map(a=>a.getAttribute('href')).join(' ')));
}
await browser.close(); release();
