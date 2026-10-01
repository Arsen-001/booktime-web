// Один браузер на проверяющего: node run.mjs phase1[:arg1:arg2] phase2 ...
import { chromium } from '/Users/arsen/WebstormProjects/booking-platform/node_modules/playwright/index.mjs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
console.log('slot acquired', new Date().toISOString());
const browser = await chromium.launch();
try {
  for (const spec of process.argv.slice(2)) {
    const [file, ...args] = spec.split(':');
    const mod = await import(`./${file}.mjs?${Date.now()}`);
    console.log('=== phase', spec);
    try { await mod.run(browser, ...args); } catch (e) { console.log('PHASE FAIL', spec, e.message.split('\n')[0]); }
  }
} finally { await browser.close(); release(); }
