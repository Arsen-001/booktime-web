import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1800);
await p.getByText('Педикюр классический').first().click();
await p.waitForTimeout(700);
await p.getByRole('tab', { name: 'Лояльность' }).click();
await p.waitForTimeout(900);

// 1) valid certificate code, owned by a different client (CERT-1003, owner +374 98 878 183)
await p.getByPlaceholder('Номер').fill('CERT-1003');
await p.getByRole('button', { name: 'Найти' }).click();
await p.waitForTimeout(700);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/code-search/1-cert-found.png', fullPage: true });

// 2) try to apply it (F-06-097 transfer)
const applyBtn = p.getByRole('button', { name: 'Списать' }).first();
if (await applyBtn.count()) {
  await applyBtn.click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: 'qa/shots/loyalty-g1-2/code-search/2-cert-applied.png', fullPage: true });
}

// 3) membership guessed codes (mock never sets Membership.code -> expect "not found")
await p.getByPlaceholder('Номер').fill('lm_biz1_3');
await p.getByRole('button', { name: 'Найти' }).click();
await p.waitForTimeout(700);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/code-search/3-membership-guess1.png', fullPage: true });

await p.getByPlaceholder('Номер').fill('MEMB-1000');
await p.getByRole('button', { name: 'Найти' }).click();
await p.waitForTimeout(700);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/code-search/4-membership-guess2.png', fullPage: true });

console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
