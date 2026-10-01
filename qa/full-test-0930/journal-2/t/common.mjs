export const waitReady = async (p) => { for (let i=0;i<40;i++){ let busy=1; try { busy = await p.evaluate(()=>document.querySelectorAll('[aria-busy="true"]').length); } catch {} if(!busy) break; await p.waitForTimeout(400);} await p.waitForTimeout(600); };
export const dlg = (p) => p.evaluate(()=>{const ds=[...document.querySelectorAll('[role=dialog]')].filter(d=>d.getClientRects().length);return ds.length?ds.map(d=>d.innerText).join('\n-----\n'):'NO DIALOG'});
export const btns = (p, scope='[role=dialog]') => p.evaluate((s)=>{const d=[...document.querySelectorAll(s)].filter(d=>d.getClientRects().length).pop()||document; return [...d.querySelectorAll('button,[role=tab],[role=menuitem],a')].filter(e=>e.getClientRects().length).map(e=>(e.getAttribute('aria-label')||e.innerText||'').trim().replace(/\s+/g,' ').slice(0,40)).filter(Boolean).join(' | ')}, scope);
export const toasts = (p) => p.evaluate(()=>[...document.querySelectorAll('[role=status],[role=alert],[data-sonner-toast],[data-toast]')].map(e=>e.innerText.trim()).filter(Boolean).join(' || '));
export async function go(page, route) {
  const u = new URL(page.url()); const keep = new URLSearchParams(); for (const k of ['demo','empty','sphere','lang','theme','api']) if (u.searchParams.get(k)) keep.set(k, u.searchParams.get(k));
  await page.goto(`http://localhost:3710${route}${route.includes('?') ? '&' : '?'}${keep}`, { waitUntil: 'networkidle' }).catch(()=>{});
  await page.waitForTimeout(1000);
}
