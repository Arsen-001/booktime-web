import { startShared } from './h.mjs';
const stop = await startShared();
try {
  for (const s of process.argv.slice(2)) {
    console.log(`\n===== ${s}`);
    try { await import(`./${s}.mjs`); } catch (e) { console.log('SCRIPT FAIL', s, e.message); }
  }
} finally { await stop(); }
