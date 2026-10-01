globalThis.__keep = true;
const { start, stop } = await import('./lib.mjs');
await start();
for (const s of ['./s1-offer.mjs', './s3-actions.mjs', './s2-sweep.mjs']) {
  console.log('=== ' + s);
  try { await import(s); } catch (e) { console.log('SCRIPT FAIL', s, e.message.slice(0, 300)); }
}
globalThis.__keep = false; await stop();
console.log('ALL DONE');
