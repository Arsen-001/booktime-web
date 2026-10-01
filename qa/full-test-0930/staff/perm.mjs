import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const B='http://localhost:3710';
const OUT='/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/staff/';
const release = await acquireBrowserSlot({ timeoutMs: 4*3600_000 });
const browser = await chromium.launch();
const res = {};
try {
  const personas = process.argv.slice(2);
  for (const p of personas) {
    const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
    const page = await ctx.newPage(); page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(240000);
    const errs=[]; page.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,200)); });
    await page.goto(`${B}/biz/staff?demo=${p}&sphere=nails&lang=ru&empty=0&api=normal`, {waitUntil:'domcontentloaded'});
    await page.locator('main').first().waitFor({timeout:120000}).catch(()=>{}); await page.waitForTimeout(3000);
    // own staffId via user menu? collect links in nav
    const navHasStaff = await page.locator('nav a[href="/biz/staff"]').count();
    res[p]={navHasStaff, routes:{}};
    const routes=['/biz/staff','/biz/staff/positions','/biz/staff/roles','/biz/staff/log','/biz/staff/license'];
    for (const r of routes) { try {
      await page.goto(B+r,{waitUntil:'domcontentloaded'}); await page.locator('main h1').first().waitFor({timeout:120000}).catch(()=>{}); await page.waitForTimeout(3000);
      const txt = (await page.locator('main').innerText().catch(()=>'')).slice(0,400).replace(/\s+/g,' ');
      const buttons = await page.locator('main button:visible').evaluateAll(els=>els.map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0,25));
      const disabledSwitches = await page.locator('main [role=switch][disabled], main input[type=checkbox][disabled]').count();
      const switches = await page.locator('main [role=switch], main input[type=checkbox]').count();
      res[p].routes[r]={url:page.url(), noAccess: /Доступ запрещён/.test(txt), txt, buttons, switches, disabledSwitches}; console.log(p, r, JSON.stringify(res[p].routes[r]));
      await page.screenshot({path:`${OUT}perm-${p}${r.replaceAll('/','_')}.png`});
    } catch(e){ res[p].routes[r]={error:String(e.message).slice(0,120)}; } }
    res[p].errs=errs.slice(0,10);
    await ctx.close();
  }
} finally { await browser.close(); release(); }
console.log(JSON.stringify(res,null,1));
