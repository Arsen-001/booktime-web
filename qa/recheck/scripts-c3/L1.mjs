import { start, stop, open, db } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/loyalty/certificates');
const d = await db(page);
console.log('core', Object.keys(d.core)); console.log('areas', Object.keys(d.areas)); console.log('access', JSON.stringify(d.access).slice(0,300)); console.log('meta', JSON.stringify(d.meta).slice(0,300));
const lo = d.areas.loyalty; console.log('loyalty', Object.keys(lo));
console.log(JSON.stringify(lo.certificates.slice(0,2), null, 0).slice(0,1500));
console.log(JSON.stringify((lo.transactions||[]).filter(t=>/cert/i.test(JSON.stringify(t))).slice(0,5)).slice(0,1500));
await stop();
