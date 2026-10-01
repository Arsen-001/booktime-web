import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const B='http://localhost:3710';
const OUT='/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/staff/';
const log=(...a)=>console.log(...a);
const release = await acquireBrowserSlot({ timeoutMs: 4*3600_000 });
const browser = await chromium.launch();
const shot=(p,n)=>p.screenshot({path:OUT+'act-'+n+'.png'});
const settle=async(p,ms=1800)=>{await p.locator('main h1').first().waitFor({timeout:120000}).catch(()=>{});await p.waitForLoadState('networkidle',{timeout:20000}).catch(()=>{});await p.waitForTimeout(ms);};
async function step(name, fn){ try{ await fn(); log('OK', name);}catch(e){ log('FAIL', name, String(e.message).split('\n')[0].slice(0,200)); } }
try {
  const ctx = await browser.newContext({ viewport:{width:1440,height:900} });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(240000);
  const errs=[]; page.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,200)); });
  page.on('pageerror', e=>errs.push('PAGEERR '+e.message.slice(0,200)));
  const go=async(url)=>{await page.goto(B+url,{waitUntil:'domcontentloaded'});await settle(page);};
  await go('/biz/staff?demo=owner&sphere=nails&lang=ru&empty=0&api=normal');
  const main=()=>page.locator('main').innerText();
  const arr=null;
  const admin={id:'st_nuri_admin',name:'Лилит Мкртчян'}, master={id:'st_nuri_ani',name:'Ани Саргсян'}, master2={id:'st_nuri_gayane',name:'Гаяне Оганесян'}, owner={id:'st_nuri_owner',name:'Нарине Акопян'}, biz='biz_nuri';
  log('IDS', JSON.stringify({biz, admin:admin&&[admin.id,admin.name], master:master&&[master.id,master.name], master2:master2&&[master2.id,master2.name], owner:owner&&[owner.id,owner.name], type: typeof staff}));

  const foreign = {id:'st_kaytsak_david', name:'Давид Варданян'};
  if(foreign) await step('owner opens staff card of ANOTHER business', async()=>{
    await go('/biz/staff/'+foreign.id); await shot(page,'owner-foreign-card');
    const t=await main(); log('  foreign', foreign.id, 'noAccess', /Доступ запрещён/.test(t), 'shows name', t.includes(foreign.name));
    await go('/biz/staff');
  });
  // 1. owner adds a staff
  const NEW='Тест Тестовая QA';
  await step('owner add staff', async()=>{
    await page.locator('main button:visible',{hasText:/^\s*Добавить/}).first().click(); await page.waitForTimeout(500);
    const it=page.getByRole('menuitem',{name:/Сотрудника/}); if(await it.count()) await it.first().click();
    await page.waitForTimeout(800);
    await shot(page,'owner-add-open');
    // submit empty first → validation
    await page.getByRole('dialog').getByRole('button',{name:'Сохранить'}).click(); await page.waitForTimeout(500);
    const dlg=await page.getByRole('dialog').innerText(); log('  empty submit errors:', /Введите имя/.test(dlg), /Введите телефон/.test(dlg));
    await page.getByRole('dialog').getByLabel('Имя').fill(NEW);
    const ph=page.getByRole('dialog').getByLabel('Телефон'); await ph.fill('77123456');
    await shot(page,'owner-add-filled');
    await page.getByRole('dialog').getByRole('button',{name:'Сохранить'}).click(); await settle(page,1500);
    await shot(page,'owner-add-done');
    log('  after save url', page.url().replace(B,''), 'setup panel', /Что делает/.test(await main()));
    await go('/biz/staff');
    const t=await main(); if(!t.includes(NEW)) throw new Error('new staff not in list; dialog open='+await page.getByRole('dialog').count());
  });
  // 2. open new staff card, edit specialty, save
  let newUrl='';
  await step('owner open card + edit + save', async()=>{
    await page.getByText(NEW).first().click(); await settle(page);
    newUrl=page.url(); log('  card url', newUrl.replace(B,''));
    await page.getByLabel('Специализация').first().fill('Педикюр QA');
    await page.getByRole('button',{name:'Сохранить'}).first().click(); await settle(page,1200);
    await shot(page,'owner-card-saved');
    await page.reload(); await settle(page);
    const v=await page.getByLabel('Специализация').first().inputValue(); if(v!=='Педикюр QA') throw new Error('specialty not persisted: '+v);
  });
  // 3. dismiss new staff
  await step('owner dismiss', async()=>{
    await page.getByRole('button',{name:'Уволить'}).first().click(); await page.waitForTimeout(800);
    await shot(page,'owner-dismiss-modal');
    const d=page.getByRole('dialog'); log('  modal:', (await d.innerText()).replace(/\s+/g,' ').slice(0,300));
    await d.getByRole('button',{name:/Уволить/}).last().click(); await settle(page,1500);
    await shot(page,'owner-dismissed');
    log('  after:', (await main()).replace(/\s+/g,' ').slice(0,200));
  });
  // 4. roles screen owner
  await step('owner roles screen', async()=>{
    await go('/biz/staff/roles'); await shot(page,'owner-roles');
    const cb=await page.locator('main [role=checkbox]:not([disabled]), main input[type=checkbox]:not([disabled])').count(); log('  enabled checkboxes', cb);
  });
  // 5. positions: owner create + delete
  await step('owner positions create/delete', async()=>{
    await go('/biz/staff/positions');
    await page.getByRole('button',{name:'Должность'}).first().click(); await page.waitForTimeout(600);
    const d=page.getByRole('dialog'); await d.getByRole('textbox').first().fill('QA-должность');
    await d.getByRole('button',{name:/Сохранить|Добавить|Создать/}).last().click(); await settle(page,1200);
    if(!(await main()).includes('QA-должность')) throw new Error('not created');
    const row=page.locator('li',{hasText:'QA-должность'}); await row.getByRole('button',{name:'Удалить'}).click(); await page.waitForTimeout(500);
    await page.getByRole('dialog').getByRole('button',{name:'Удалить'}).click(); await settle(page,1200);
    if((await main()).includes('QA-должность')) throw new Error('not deleted');
  });
  // 6. owner grants admin finance via group menu
  if(admin) await step('owner grants admin finance → admin sees finance', async()=>{
    await go('/biz/staff/'+admin.id+'?tab=access'); await page.waitForTimeout(1500);
    await shot(page,'owner-admin-access');
    const grp=page.locator('fieldset,section,div',{hasText:'Финансы'}).getByRole('button',{name:'Действия с группой'});
    log('  group menus', await page.getByRole('button',{name:'Действия с группой'}).count());
    // find the menu button nearest to "Финансы" heading
    const btns=page.getByRole('button',{name:'Действия с группой'}); const n=await btns.count(); let done=false;
    for(let i=0;i<n && !done;i++){ const box=btns.nth(i); const txt=await box.evaluate(el=>{let e=el;for(let k=0;k<5;k++){e=e.parentElement;if(e.innerText.includes('Финансы'))return e.innerText.slice(0,40);}return ''}); if(txt.startsWith('Финансы')||txt.includes('Финансы')){ await box.click(); await page.waitForTimeout(400); await page.getByRole('menuitem',{name:'Дать все'}).click(); done=true; } }
    if(!done) throw new Error('finance group menu not found');
    await page.getByRole('button',{name:'Применить права'}).click(); await settle(page,1200);
    await shot(page,'owner-admin-granted');
    await go('/biz/finance?demo=admin');
    const nav=await page.locator('nav a[href="/biz/finance"]').count();
    await shot(page,'admin-finance-after-grant');
    log('  admin finance nav link:', nav, '| main:', (await main()).replace(/\s+/g,' ').slice(0,120));
    if(!nav) throw new Error('admin does not see finance after grant');
  });
  // 7. admin actions
  await step('admin on staff list (read-only)', async()=>{
    await go('/biz/staff?demo=admin');
    const add=await page.getByRole('button',{name:'Добавить'}).count();
    const rowMenus=await page.getByRole('button',{name:/Действия|Ещё/}).count();
    await shot(page,'admin-list');
    log('  add buttons',add,'row menus',rowMenus);
  });
  if(master) await step('admin opens master card (read-only?)', async()=>{
    await go('/biz/staff/'+master.id);
    const nameDisabled=await page.getByLabel('Имя').first().isDisabled().catch(()=>'n/a');
    const fire=await page.getByRole('button',{name:'Уволить'}).count();
    const tabs=await page.getByRole('tab').allInnerTexts();
    await shot(page,'admin-master-card');
    log('  name disabled',nameDisabled,'fire btn',fire,'tabs',tabs.join('|'));
    await page.getByRole('tab',{name:/Доступ/}).click().catch(()=>{}); await page.waitForTimeout(1200);
    await shot(page,'admin-master-card-access');
    log('  access tab text:', (await main()).replace(/\s+/g,' ').slice(0,300));
  });
  if(owner) await step('admin opens owner card', async()=>{
    await go('/biz/staff/'+owner.id); await shot(page,'admin-owner-card');
    log('  legal visible:', /Паспорт|ИНН/.test(await main()));
  });
  // 8. master
  if(master) await step('master own card', async()=>{
    await go('/biz/staff/'+master.id+'?demo=master');
    await shot(page,'master-own-card');
    const t=await main(); log('  noAccess',/Доступ запрещён/.test(t),'tabs', (await page.getByRole('tab').allInnerTexts()).join('|'));
    const posDisabled=await page.getByLabel('Должность').first().isDisabled().catch(()=>'n/a');
    const hiredDisabled=await page.getByLabel(/Дата приёма|В команде с|Работает с/).first().isDisabled().catch(()=>'n/a');
    log('  master can edit own position?', !posDisabled, 'hired?', hiredDisabled);
  });
  if(master2) await step('master other card', async()=>{
    await go('/biz/staff/'+master2.id); await shot(page,'master-other-card');
    log('  noAccess', /Доступ запрещён/.test(await main()));
  });
  if(admin) await step('master opens admin card', async()=>{
    await go('/biz/staff/'+admin.id); log('  noAccess', /Доступ запрещён/.test(await main()));
  });
  // 9. owner revokes admin finance back (reset to template)
  if(admin) await step('owner resets admin rights', async()=>{
    await go('/biz/staff/'+admin.id+'?tab=access&demo=owner'); await page.waitForTimeout(1500);
    await page.getByRole('button',{name:'Ещё'}).first().click(); await page.waitForTimeout(400);
    await page.getByRole('menuitem',{name:'Сбросить к шаблону'}).click(); await page.waitForTimeout(400);
    await page.getByRole('button',{name:'Применить права'}).click(); await settle(page,1200);
    await go('/biz/staff?demo=admin');
    log('  admin finance link after reset:', await page.locator('nav a[href="/biz/finance"]').count());
  });
  // 9b. empty salon: add master, setup «как у салона» without salon hours
  await step('empty salon: add master + setup schedule', async()=>{
    await go('/biz/staff?demo=owner&empty=1');
    await shot(page,'empty-list');
    await page.locator('main button:visible',{hasText:/^\s*Добавить/}).first().click(); await page.waitForTimeout(500);
    const it=page.getByRole('menuitem',{name:/Сотрудника/}); if(await it.count()) await it.first().click();
    await page.waitForTimeout(800);
    await page.getByRole('dialog').getByLabel('Имя').fill('Пустой Мастер QA');
    await page.getByRole('dialog').getByLabel('Телефон').fill('77999888');
    await page.getByRole('dialog').getByRole('button',{name:'Сохранить'}).click(); await settle(page,2000);
    const t=await main(); log('  url', page.url().replace(B,''), '| option default week shown:', /Стандартная неделя/.test(t));
    await shot(page,'empty-setup-panel');
    await page.getByRole('button',{name:'Готово'}).click(); await page.waitForTimeout(1500);
    const toast=await page.locator('[role=status],[role=alert]').allInnerTexts().catch(()=>[]);
    log('  toast:', toast.join(' | ').replace(/\s+/g,' ').slice(0,250));
    await shot(page,'empty-setup-done');
    await page.reload(); await settle(page,2000);
    log('  notBooking badge after:', /Не принимает записи/.test(await main()), /нет графика/.test(await main()));
    await shot(page,'empty-card-after');
    await go('/biz/staff?empty=0');
  });
  // 10. states
  for (const [q,n] of [['?demo=owner&empty=1','empty'],['?demo=owner&empty=0&api=error','error'],['?api=slow','slow']]) {
    await step('state '+n, async()=>{
      await page.goto(B+'/biz/staff'+q,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(n==='slow'?700:3000);
      await shot(page,'state-'+n);
      log('  ', (await main()).replace(/\s+/g,' ').slice(0,200));
    });
  }
  await page.goto(B+'/biz/staff?api=normal',{waitUntil:'domcontentloaded'});
  // 11. phone
  const ph = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const pp = await ph.newPage(); pp.setDefaultTimeout(60000); pp.setDefaultNavigationTimeout(240000);
  for (const r of ['/biz/staff?demo=owner','/biz/staff/positions','/biz/staff/roles','/biz/staff/log'+'']) {
    await pp.goto(B+r,{waitUntil:'domcontentloaded'}); await settle(pp,2000);
    const over=await pp.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    await pp.screenshot({path:OUT+'phone'+r.split('?')[0].replaceAll('/','_')+'.png'});
    log('phone',r,'hscroll',over);
  }
  if(admin){ await pp.goto(B+'/biz/staff/'+admin.id+'?tab=access',{waitUntil:'domcontentloaded'}); await settle(pp,2500); await pp.screenshot({path:OUT+'phone_admin_access.png',fullPage:false}); log('phone access hscroll', await pp.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)); }
  log('ERRS', JSON.stringify([...new Set(errs)].slice(0,15)));
} finally { await browser.close(); release(); }
