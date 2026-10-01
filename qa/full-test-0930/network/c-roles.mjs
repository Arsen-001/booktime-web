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
  for (const q of ['&api=error', '&api=slow']) {
    for (const r of ['/biz/network', '/biz/network/clients', '/biz/network/settings']) {
      await page.goto(`http://localhost:3710${r}?demo=network&lang=ru${q}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(q === '&api=slow' ? 700 : 4000);
      say(`${q} ${r}:`, flat(await text(page), 200));
      await shot(page, `c${q.replace(/\W/g, '')}-${r.split('/').pop()}`);
    }
  }
  // хаб настроек филиала: вклад «Принадлежность к сети»
  await go(page, '/biz/settings');
  const t = await text(page);
  say('settings hub network block:', flat(t.slice(Math.max(0, t.indexOf('сет') - 200), t.indexOf('сет') + 300), 500));
  await shot(page, 'c-settings-hub', true);
  await ctx.close();
}
// телефон ru + десктоп en: главные экраны
for (const [device, lang] of [['phone', 'ru'], ['desktop', 'en'], ['phone', 'en']]) {
  const { ctx, page, errors } = await newPage(browser, { device, lang });
  for (const r of ['/biz/network', '/biz/network/settings', '/biz/network/clients', '/biz/network/settings/users', '/biz/network/switch', '/biz/network/analytics', '/biz/network/telephony', '/biz/network/staff', '/biz/network/services', '/biz/network/goods', '/biz/network/records', '/biz/network/settings/fields', '/biz/network/loyalty']) {
    errors.length = 0;
    await go(page, r, { lang });
    const a = await audit(page);
    await shot(page, `sweep/${r.split('/').slice(3).join('_') || 'overview'}__${device}-${lang}`);
    const cyr = lang === 'en' ? ((await text(page)).match(/[А-Яа-яЁё]{3,}[^\n]{0,30}/g) ?? []).slice(0, 3) : [];
    say(`${device}-${lang} ${r} raw=${a.raw.join('|')} overflow=${a.overflow} small=${a.small.join('|')} title=${a.titled.join('|')} cyr=${cyr.join(' / ')} errs=${clean(errors).join(' || ').slice(0, 300)}`);
  }
  await ctx.close();
}
await browser.close();
