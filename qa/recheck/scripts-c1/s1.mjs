import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('owner', '/biz/schedule', { device: 'desktop' });
log((await text(page)).slice(0, 3000));
await shot(page, 's1-schedule');
log('ERR', page.errors.slice(0,3));
await stop();
