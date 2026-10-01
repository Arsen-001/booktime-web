import { start, stop, open, go, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/clients');
const step = async (name, fn) => { try { console.log('\n=== ' + name); await fn(); } catch (e) { console.log('!! FAIL', name, e.message.slice(0, 300)); await shot(page, 'K1-fail-' + name.replace(/\W+/g,'_')); } };
const T = async (n=1200) => (await text(page)).slice(0, n);
await step('segments', async () => {
  for (const seg of ['Часто не приходят', 'Заканчивается абонемент', 'Новые']) {
    await go(page, '/biz/clients');
    const b = page.getByRole('button', { name: new RegExp('^' + seg) }); const label = await b.innerText();
    await b.click(); await page.waitForTimeout(1500);
    const t = await T(4000); const cnt = t.split('\n').find(l => /клиент(ов|а)?$/.test(l.trim()) || /Найдено|из \d+/.test(l));
    const names = await page.locator('main tbody tr').count();
    console.log(seg, 'chip=', label.replace(/\n/g,' '), '| header=', cnt, '| rows on page=', names, '|', (t.split('\n').filter(l => /из \d+/.test(l)).slice(0,2)));
    if (seg === 'Заканчивается абонемент') { const ids = await page.locator('main a[href^="/biz/journal?new=1&client="]').evaluateAll(a => a.map(x => x.getAttribute('href').split('client=')[1])); console.log('  ids', ids.join(',')); }
    await shot(page, 'K1-seg-' + seg.replace(/\s+/g,'_'));
  }
  const d = await db(page); console.log('loyalty memberships biz_nuri clients', d.areas.loyalty.memberships.filter(m => m.businessId === 'biz_nuri').map(m => m.clientId + ':' + m.status + ':' + m.visitsLeft + ':' + m.expiresAt).join(' '));
});
await step('balances', async () => {
  for (const id of ['cl_018', 'cl_069', 'cl_081', 'cl_001']) {
    await go(page, '/biz/clients/' + id);
    const t = await T(6000); const head = t.split('\n'); const i = head.indexOf('Продано');
    const hist = head.filter(l => /^Оплачено .* из /.test(l));
    const sold = hist.reduce((a, l) => { const m = l.match(/Оплачено ([\d\s ]+) ֏ из ([\d\s ]+) ֏/); return m ? [a[0] + +m[1].replace(/\D/g,''), a[1] + +m[2].replace(/\D/g,'')] : a; }, [0, 0]);
    console.log(id, head.slice(i, i + 5).join(' | '), '|| history paid/sold', sold, 'lines', hist.length, head.filter(l => /Должник|Аванс|Долг/.test(l)).slice(0, 3));
  }
});
await stop();
