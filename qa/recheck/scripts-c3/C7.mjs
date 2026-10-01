import { start, stop, open, db } from './lib.mjs';
await start();
const { page } = await open('client', '/memberships', { device: 'phone' });
const d = await db(page);
console.log(JSON.stringify(d.areas.client.memberships, null, 0).slice(0, 2500));
console.log('templates', JSON.stringify(d.areas.client.membershipTemplates).slice(0, 800));
await stop();
