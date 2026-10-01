// Сценарий C: роли и состояния — admin/master/owner/owner-empty на /biz/network, api=error, api=slow, en, телефон, хаб настроек
import { connect, newPage, go, shot, text, audit } from './h.mjs';
const browser = await connect();
const say = (...a) => console.log(...a);
const flat = (s, n = 300) => s.replace(/\n+/g, ' | ').slice(0, n);
const clean = (errs) => errs.filter((e) => !/DevTools|HMR|Fast Refresh/.test(e));
{
  const { ctx, page, errors } = await newPage(browser, { device: 'desktop' });
  for (const persona of ['owner', 'admin', 'master', 'owner-empty']) {
    const [demo, empty] = persona === 'owner-empty' ? ['owner', '&empty=1'] : [persona, '&empty=0'];
    for (const r of ['/biz/network', '/biz/network/clients', '/biz/network/switch']) {
      errors.length = 0;
      await go(page, r, { persona: demo, extra: empty });
      say(`${persona} ${r}:`, flat(await text(page), 250), 'errs', clean(errors).length, clean(errors).join(' || ').slice(0, 300));
      await shot(page, `c-${persona}-${r.split('/').pop()}`);
    }
  }
  await ctx.close();
}
await browser.close();
