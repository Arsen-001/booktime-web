// Один браузер на проверяющего: держит слот, выполняет JS-фрагменты, присланные POST на :4791
import http from 'node:http';
import * as L from './lib.mjs';
const release = await (await import('/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs')).acquireBrowserSlot();
const { chromium } = await import('playwright');
const browser = await chromium.launch();
const state = { pages: {} };
console.log('READY');
let idle = Date.now();
setInterval(async () => { if (Date.now() - idle > 15 * 60_000) { await browser.close(); release(); process.exit(0); } }, 30_000);
http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c; idle = Date.now();
  if (body === 'QUIT') { res.end('bye'); await browser.close(); release(); process.exit(0); }
  const logs = []; const log = (...a) => logs.push(a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  try {
    const fn = new (Object.getPrototypeOf(async function () {}).constructor)('browser', 'state', 'L', 'log', body);
    const r = await fn(browser, state, L, log);
    res.end(logs.join('\n') + (r !== undefined ? '\n=> ' + (typeof r === 'string' ? r : JSON.stringify(r, null, 1)) : ''));
  } catch (e) { res.end(logs.join('\n') + '\nERR ' + (e.stack || e).toString().slice(0, 1500)); }
}).listen(4791);
