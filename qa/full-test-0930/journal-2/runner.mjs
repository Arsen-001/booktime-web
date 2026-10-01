// Держит один браузер (через слот) и выполняет файлы cmd/<n>.mjs: export default async ({browser, ctx, lib}) => string
import fs from 'node:fs';
import * as lib from './lib.mjs';
import { chromium } from '/Users/arsen/WebstormProjects/booking-platform/node_modules/playwright/index.mjs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const DIR = lib.OUT + '/cmd';
fs.mkdirSync(DIR, { recursive: true });
const release = await acquireBrowserSlot({ timeoutMs: 4 * 3600_000 });
const browser = await chromium.launch();
fs.writeFileSync(DIR + '/READY', '1');
const state = {};
let idle = Date.now();
for (;;) {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.mjs')).sort();
  for (const f of files) {
    const path = `${DIR}/${f}`;
    const outp = path.replace(/\.mjs$/, '.out');
    let out = '';
    try { const m = await import(path + '?t=' + Date.now()); out = String(await m.default({ browser, lib, state })); }
    catch (e) { out = 'ERROR ' + (e.stack || e).toString().slice(0, 2000); }
    fs.renameSync(path, path + '.done');
    fs.writeFileSync(outp, out);
    idle = Date.now();
  }
  if (fs.existsSync(DIR + '/STOP') || Date.now() - idle > 20 * 60_000) break;
  await new Promise(r => setTimeout(r, 300));
}
await browser.close(); release(); fs.rmSync(DIR + '/READY', { force: true });
process.exit(0);
