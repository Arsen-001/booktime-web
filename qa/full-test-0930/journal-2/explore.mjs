import { withBrowser, openPage, fids, shot, text } from './lib.mjs';
await withBrowser(async (b) => {
  for (const [persona, device] of [['owner','desktop'],['master','phone'],['admin','phone']]) {
    const p = await openPage(b, { persona, device });
    await shot(p, `x-${persona}-${device}`);
    console.log('==', persona, device, (await fids(p)).join(' '));
    console.log((await text(p)).slice(0, 1500));
    console.log('ERR', p.errors.slice(0,5));
    await p.context().close();
  }
});
