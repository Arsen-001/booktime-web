const M = await import('/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs?' + Date.now());
const { waitReady, dlg, btns, toasts, go } = M;
export default async ({ browser, lib, state }) => {
  const m = state.master; let o='';
  await m.keyboard.press('Escape');
  await go(m, '/biz/records'); await waitReady(m); await m.waitForTimeout(1500);
  let t = await lib.text(m);
  o += 'REC head ' + t.slice(0,400).replace(/\n+/g,' / ') + '\n';
  const specs = [...new Set((t.match(/Специалист\n+([^\n]+)/g)||[]).map(x=>x.split('\n').pop()))]; o += 'specialists in list: ' + specs.join(',') + '\n';
  const dates = (t.match(/\d\d\.\d\d\.\d{4}, \d\d:\d\d/g)||[]); o += 'dates sample: ' + dates.slice(0,40).join(' ') + '\n';
  o += 'buttons: ' + (await btns(m, 'main')).slice(0,600) + '\n';
  await lib.shot(m, 'p5-master-records');
  await go(m, '/biz/journal/settings'); await waitReady(m); await m.waitForTimeout(1000);
  o += 'SETTINGS as master: ' + (await lib.text(m)).slice(0,500).replace(/\n+/g,' / ') + '\n';
  await lib.shot(m, 'p6-master-settings');
  return o;
};
