// Один слот браузера на все сценарии: node run-all.mjs s1-prepay.mjs s2-expired.mjs ...
globalThis.__KEEP_BROWSER = true;
for (const f of process.argv.slice(2)) {
  console.log(`\n========== ${f} ==========`);
  try {
    await import(`./${f}?${Date.now()}`);
  } catch (e) {
    console.log('SCENARIO FAILED', f, e?.stack?.slice(0, 800));
  }
}
await globalThis.__closeShared?.();
