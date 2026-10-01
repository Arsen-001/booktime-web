// Экраны раздела по ролям/состояниям: телефон+десктоп, api=error, пустой бизнес, мастер, hy
import { ctx, go, shot } from './lib.mjs';
const log = (...a) => console.log(...a);
const ROUTES = ['/biz/schedule', '/biz/schedule/calendar', '/biz/schedule/templates', '/biz/schedule/slots', '/biz/schedule/slots/st_nuri_ani', '/biz/schedule/series', '/biz/schedule/history'];
async function visit(b, opts, routes, tag) {
  const { c, page, errors } = await ctx(b, opts);
  for (const r of routes) {
    const n0 = errors.length;
    try {
      await go(page, r);
      await page.waitForTimeout(1200);
      const name = `scr-${tag}-${r.replace(/\//g, '_')}`;
      await shot(page, name);
      const txt = (await page.innerText('main').catch(() => '')).replace(/\s+/g, ' ');
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const raw = txt.match(/\b[a-z]+\.[a-zA-Z]+\.[a-zA-Z.]+\b/g) || [];
      log(`[${tag}] ${r} overflow=${ov} raw=${raw.slice(0, 3)} err=${errors.slice(n0).map((e) => e.slice(0, 140)).join(' || ')} :: ${txt.slice(0, 160)}`);
    } catch (e) { log(`[${tag}] ${r} FAIL ${e.message.slice(0, 150)}`); }
  }
  await c.close();
}
export async function run(b) {
  await visit(b, { device: 'phone' }, ['/biz/schedule', '/biz/schedule/series', '/biz/schedule/history'], 'owner-phone');
  await visit(b, { device: 'desktop' }, ['/biz/schedule', '/biz/schedule/templates'], 'owner-desk');
  await visit(b, { device: 'phone', persona: 'master' }, ['/biz/schedule', '/biz/schedule/calendar'], 'master-phone');
  await visit(b, { device: 'phone', persona: 'owner', extra: '&empty=1' }, ['/biz/schedule', '/biz/schedule/series'], 'empty-phone');
  await visit(b, { device: 'phone', extra: '&api=error' }, ['/biz/schedule', '/biz/schedule/calendar'], 'error-phone');
  await visit(b, { device: 'phone', lang: 'hy' }, ['/biz/schedule'], 'hy-phone');
}
