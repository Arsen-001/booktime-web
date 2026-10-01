import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.setViewportSize({ width: 1440, height: 900 });

await p.goto('http://localhost:3710/biz/loyalty/certificates?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1500);
console.log('CERT_TABLE:', (await p.locator('table, [role=table]').first().innerText().catch(()=>'n/a')).slice(0,1000));
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/lists/1-certs.png', fullPage: true });

await p.goto('http://localhost:3710/biz/loyalty/memberships?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1500);
console.log('MEMB_TABLE:', (await p.locator('table, [role=table]').first().innerText().catch(()=>'n/a')).slice(0,1500));
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/lists/2-memberships.png', fullPage: true });

await p.goto('http://localhost:3710/biz/loyalty/deposits?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1500);
console.log('DEPOSITS_TABLE:', (await p.locator('table, [role=table]').first().innerText().catch(()=>'n/a')).slice(0,1500));
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/lists/3-deposits.png', fullPage: true });

console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
