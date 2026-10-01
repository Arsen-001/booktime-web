import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const B='http://localhost:3710', OUT='/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/staff/';
const release = await acquireBrowserSlot({ timeoutMs: 4*3600_000 });
const browser = await chromium.launch();
const log=(...a)=>console.log(...a);
try {
  const ctx=await browser.newContext({viewport:{width:1440,height:900}}); const page=await ctx.newPage();
  page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(240000);
  const go=async u=>{await page.goto(B+u,{waitUntil:'domcontentloaded'}); await page.locator('main h1').first().waitFor({timeout:120000}).catch(()=>{}); await page.waitForTimeout(2500);};
  await go('/biz/staff/st_nuri_admin?tab=access&demo=owner&empty=0&api=normal');
  await page.getByRole('button',{name:/Настроить права доступа/}).click(); await page.waitForTimeout(800);
  await page.screenshot({path:OUT+'grant-1.png'});
  const items=await page.getByRole('menuitem').allInnerTexts(); log('menu items', items.join(' | '));
  // try to open editor
  const edit=page.getByRole('menuitem').filter({hasText:/Настроить|Изменить|Отдельн|вручную/}).first();
  if(await edit.count()) { await edit.click(); await page.waitForTimeout(1500); }
  await page.screenshot({path:OUT+'grant-2.png'});
  log('group menus', await page.getByRole('button',{name:'Действия с группой'}).count());
  const cb=page.getByRole('checkbox',{name:'Финансы',exact:true}).filter({visible:true}).first();
  log('finance cb state before', await cb.getAttribute('aria-checked'));
  await cb.click(); await page.waitForTimeout(600);
  log('finance cb state after', await cb.getAttribute('aria-checked'));
  const done=true;
  log('granted?', done);
  if(done){ await page.getByRole('button',{name:'Применить права'}).click(); await page.waitForTimeout(2500); await page.screenshot({path:OUT+'grant-3.png'});
    await go('/biz/finance?demo=admin'); log('admin finance nav', await page.locator('nav a[href="/biz/finance"]').count(), (await page.locator('main').innerText()).replace(/\s+/g,' ').slice(0,120));
    await page.screenshot({path:OUT+'grant-4-admin-finance.png'});
    // revoke
    await go('/biz/staff/st_nuri_admin?tab=access&demo=owner');
    await page.getByRole('button',{name:/Настроить права доступа/}).click(); await page.waitForTimeout(800);
    await page.waitForTimeout(800);
    const cb2=page.getByRole('checkbox',{name:'Финансы',exact:true}).filter({visible:true}).first(); await cb2.click(); await page.waitForTimeout(600);
    await page.getByRole('button',{name:'Применить права'}).click(); await page.waitForTimeout(2500);
    await go('/biz/finance?demo=admin'); await page.screenshot({path:OUT+'grant-5-admin-finance-revoked.png'}); log('admin /biz/finance after revoke:', (await page.locator('main').innerText()).replace(/\s+/g,' ').slice(0,120));
    await go('/biz/staff?demo=admin'); log('admin finance nav after reset', await page.locator('nav a[href="/biz/finance"]').count());
  }
} finally { await browser.close(); release(); }
