import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('owner', '/biz/journal', { device: 'desktop' });
log((await text(page)).slice(0, 2500));
await shot(page, 'j1-journal');
log('ERR', page.errors.slice(0,4));
await stop();
