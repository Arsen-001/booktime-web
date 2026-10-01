import { closeShared } from './h.mjs';
process.env.KEEP = '1';
for (const f of process.argv.slice(2)) {
  console.log('\n==== ' + f);
  try { await import('./' + f); } catch (e) { console.log('IMPORT FAIL', e.message); }
}
await closeShared();
