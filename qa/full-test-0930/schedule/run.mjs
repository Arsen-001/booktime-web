import { withBrowser } from './lib.mjs';
const names = process.argv.slice(2);
await withBrowser(async (b) => {
  for (const n of names) {
    console.log(`\n===== ${n}`);
    const m = await import(`./${n}.mjs`);
    try { await m.run(b); } catch (e) { console.log('[FAIL]', n, e.message.split('\n').slice(0, 6).join(' / ')); }
  }
});
