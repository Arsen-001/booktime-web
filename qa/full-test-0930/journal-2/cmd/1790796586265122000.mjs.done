import { waitReady, dlg, btns } from '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2/t/common.mjs';
export default async ({ browser, lib, state }) => {
  const p = await lib.openPage(browser, { persona: 'owner', device: 'desktop' });
  state.owner = p;
  await waitReady(p);
  let o = 'BTNS ' + await btns(p, 'main') + '\n';
  o += 'cards ' + await p.locator('[data-testid=booking-block]').count() + '\n';
  await p.locator('[data-testid=booking-block]').first().click(); await p.waitForTimeout(2500); await waitReady(p);
  await lib.shot(p, 'o1-window');
  o += 'URL ' + p.url() + '\nFIDS ' + (await lib.fids(p)).join(' ') + '\n';
  o += 'DLG ' + (await dlg(p)).slice(0, 3500) + '\n';
  o += 'DBTNS ' + await btns(p) + '\nERR ' + p.errors.join('\n');
  return o;
};
