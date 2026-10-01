// usage: node probe.mjs persona route [device] -> prints main text
import { start, stop, open, text, shot } from './lib.mjs';
const [persona, route, device='desktop', name] = process.argv.slice(2);
await start();
const { page } = await open(persona, route, { device });
console.log((await text(page, 'body')).slice(0, 6000));
if (name) await shot(page, name, true);
console.log('ERR', page.errors.slice(0,5));
await stop();
