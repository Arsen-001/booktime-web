import { start, stop, open, db } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/moderation', { device: 'desktop' });
const d = await db(page);
for (const m of d.areas.platform.moderationItems) console.log(JSON.stringify(m).slice(0,330));
await stop();
