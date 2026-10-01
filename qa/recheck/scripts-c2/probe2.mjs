import { start, stop, open } from './lib.mjs';
await start();
const { page } = await open('guest', '/b/nuri-nail-studio/book', { device: 'phone' });
const msgs = []; page.on('console', m => msgs.push(m.text().slice(0,200)));
await page.reload(); await page.waitForTimeout(5000);
console.log([...new Set(msgs)].slice(0,8), page.errors.slice(0,5));
await stop();
