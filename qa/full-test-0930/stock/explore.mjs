import { start } from './h.mjs';
const routes = process.argv.slice(2);
const t = await start();
try {
  for (const r of routes) {
    const [persona, route, device='desktop'] = r.split('|');
    await t.go(persona, route, device);
    const txt = await t.text();
    console.log(`\n==== ${persona} ${route} ${device}\n` + txt.slice(0, 2500));
    console.log('BUTTONS:', JSON.stringify(await t.buttons()).slice(0, 2500));
    await t.shot(`x-${persona}-${route.replace(/[\/?=&]/g,'_')}-${device}`);
  }
  console.log('ERRORS', t.errors.slice(0,20));
} finally { await t.end(); }
