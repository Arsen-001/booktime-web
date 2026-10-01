import { withBrowser, openPage, fids, shot, text, goto } from './lib.mjs';
const waitReady = async (p) => { for (let i=0;i<40;i++){ const busy = await p.evaluate(()=>document.querySelectorAll('[aria-busy="true"]').length); if(!busy) break; await p.waitForTimeout(500);} await p.waitForTimeout(800); };
await withBrowser(async (b) => {
  const p = await openPage(b, { persona: 'owner', device: 'desktop' });
  await waitReady(p);
  // buttons list
  console.log('BTNS', await p.evaluate(()=>[...document.querySelectorAll('button,a[role=button],[role=tab]')].filter(e=>e.getClientRects().length).map(e=>(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,40)).filter(Boolean).join(' | ')));
  // open first booking card
  const card = p.locator('[data-booking-id]').first();
  console.log('cards', await p.locator('[data-booking-id]').count());
  await card.click(); await p.waitForTimeout(2500); await waitReady(p);
  await shot(p, 'o1-window');
  console.log('URL', p.url());
  console.log('WIN FIDS', (await fids(p)).join(' '));
  console.log('WIN', (await p.evaluate(()=>{const d=document.querySelector('[role=dialog]');return d?d.innerText:'NO DIALOG'})).slice(0,3000));
  console.log('WINBTNS', await p.evaluate(()=>{const d=document.querySelector('[role=dialog]')||document; return [...d.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>(e.getAttribute('aria-label')||e.innerText||'').trim().slice(0,40)).filter(Boolean).join(' | ')}));
  console.log('ERR', p.errors.slice(0,8));
});
