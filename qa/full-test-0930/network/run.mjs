// Один слот на несколько сценариев подряд: RUNNER=1 node run.mjs a-settings.mjs b-main.mjs
process.env.RUNNER = '1';
for (const f of process.argv.slice(2)) {
  console.log('===== ' + f);
  try { await import('./' + f); } catch (e) { console.log('SCRIPT FAIL', f, e.message.slice(0, 300)); }
}
await globalThis.__netBrowser?.reallyClose();
process.exit(0);
