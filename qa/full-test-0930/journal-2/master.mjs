import { withBrowser, openPage, fids, shot, text, goto } from './lib.mjs';
const waitReady = async (p) => { for (let i=0;i<40;i++){ const busy = await p.evaluate(()=>document.querySelectorAll('[aria-busy="true"], [class*="skeleton" i]').length); if(!busy) break; await p.waitForTimeout(500);} await p.waitForTimeout(800); };
await withBrowser(async (b) => {
  const p = await openPage(b, { persona: 'master', device: 'phone' });
  await waitReady(p);
  await shot(p, 'm1-master-phone-journal');
  console.log('FIDS', (await fids(p)).join(' '));
  console.log((await text(p)).slice(0, 1200));
  // week view
  await goto(p, '/biz/records'); await waitReady(p);
  await shot(p, 'm2-master-phone-records');
  console.log('REC', (await text(p)).slice(0, 2000));
  await goto(p, '/biz/journal/settings'); await waitReady(p);
  await shot(p, 'm3-master-phone-settings');
  console.log('SET', (await text(p)).slice(0, 600));
  console.log('ERR', p.errors.slice(0,8));
});
