import { withBrowser, newPage, go, text, shot, BASE } from './lib.mjs';
const log = (...a) => console.log(...a);
async function checks(p, tag) {
  const r = await p.evaluate(() => {
    const over = document.documentElement.scrollWidth > window.innerWidth + 1;
    const raw = (document.body.innerText.match(/\b(notify|common|ui)\.[a-zA-Z]+\.[a-zA-Z.]+/g) || []).slice(0, 5);
    const small = [...document.querySelectorAll('main button, main a, main [role=button]')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && (b.height < 40 && b.width < 40); }).length;
    return { over, raw, small, skel: document.querySelectorAll('[data-skeleton]').length };
  });
  log('CHECK', tag, JSON.stringify(r));
}
await withBrowser(async (b) => {
  // A. owner desktop
  const p = await newPage(b);
  const routes = ['/biz/notifications','/biz/notifications/types/1','/biz/notifications/types/73','/biz/notifications/types/7','/biz/notifications/channels','/biz/notifications/log','/biz/notifications/mailings','/biz/notifications/mailings/new','/biz/notifications/inbox','/biz/notifications/loyalty','/biz/notifications/channels/sms','/biz/notifications/channels/whatsapp','/biz/notifications/channels/catalog','/biz/notifications/channels/balance','/biz/notifications/channels/developer','/biz/notifications/channels/promotion','/biz/notifications/channels/email','/biz/notifications/types/1/templates'];
  for (const r of routes) {
    await go(p, r, 3000);
    const n = r.replace(/\//g, '_');
    await shot(p, 'd' + n);
    await checks(p, r);
    log('=====', r, '\n' + (await text(p)).slice(0, 1800).replace(/\n+/g, ' | '));
  }
  log('ERRORS-A', JSON.stringify(p.errors));
  // B. phone
  const ph = await newPage(b, { phone: true });
  for (const r of ['/biz/notifications','/biz/notifications/types/1','/biz/notifications/log','/biz/notifications/channels','/biz/notifications/mailings']) {
    await go(ph, r, 3000);
    await ph.screenshot({ path: `/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/notify/p${r.replace(/\//g,'_')}.png`, fullPage: true });
    await checks(ph, 'phone ' + r);
  }
  log('ERRORS-B', JSON.stringify(ph.errors));
  // E. roles
  for (const persona of ['admin', 'master', 'individual', 'network']) {
    const rp = await newPage(b, { persona });
    for (const r of ['/biz/notifications','/biz/notifications/log','/biz/notifications/mailings','/biz/notifications/types/1']) {
      await go(rp, r, 3000);
      log('ROLE', persona, r, '::', (await text(rp)).slice(0, 400).replace(/\n+/g, ' | '));
    }
    await shot(rp, 'role-' + persona);
    log('ERRORS-' + persona, JSON.stringify(rp.errors));
    await rp.context().close();
  }
  // F. empty, error, slow
  for (const [tag, url] of [['empty', '/biz?demo=owner&empty=1'], ['error', '/biz?demo=owner&empty=0&api=error'], ['slow', '/biz?demo=owner&api=slow']]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const q = await ctx.newPage();
    await q.goto(BASE + url, { timeout: 180000 }).catch(()=>{}); await q.waitForTimeout(1500);
    for (const r of ['/biz/notifications','/biz/notifications/log','/biz/notifications/mailings','/biz/notifications/inbox']) {
      await go(q, r, tag === 'slow' ? 1200 : 3000);
      await shot(q, `${tag}${r.replace(/\//g,'_')}`);
      log('STATE', tag, r, '::', (await text(q)).slice(0, 400).replace(/\n+/g, ' | '));
    }
    await ctx.close();
  }
  // G. en
  const en = await newPage(b, { lang: 'en' });
  for (const r of ['/biz/notifications','/biz/notifications/types/1','/biz/notifications/log']) {
    await go(en, r, 3000); await shot(en, 'en' + r.replace(/\//g,'_')); await checks(en, 'en ' + r);
    log('EN', r, (await text(en)).slice(0, 600).replace(/\n+/g, ' | '));
  }
  
});
