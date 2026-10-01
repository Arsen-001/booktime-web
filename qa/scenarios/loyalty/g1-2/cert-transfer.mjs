import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error' || /Quota/.test(m.text())) errs.push(m.type()+': ' + m.text()); });
await p.setViewportSize({ width: 1440, height: 900 });
await p.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1800);
await p.getByText('Педикюр классический').first().click();
await p.waitForTimeout(700);
await p.getByRole('tab', { name: 'Лояльность' }).click();
await p.waitForTimeout(900);
await p.getByPlaceholder('Номер').fill('CERT-1003');
await p.getByRole('button', { name: 'Найти' }).click();
await p.waitForTimeout(700);
await p.getByRole('button', { name: 'Оплатить сертификатом' }).click();
await p.waitForTimeout(700);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/cert-transfer/1-after-pay-cert.png', fullPage: true });
const saveBtn = p.getByRole('button', { name: 'Сохранить изменения' });
console.log('save disabled?', await saveBtn.isDisabled().catch(()=>'?'));
await saveBtn.click({ force: true }).catch(()=>{});
await p.waitForTimeout(1000);
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/cert-transfer/2-after-save.png', fullPage: true });

// now check the certificates list for CERT-1003 owner
await p.goto('http://localhost:3710/biz/loyalty/certificates?demo=owner&sphere=nails&lang=ru&theme=light');
await p.waitForTimeout(1200);
console.log('CERT_TABLE_AFTER:', (await p.locator('table, [role=table]').first().innerText().catch(()=>'n/a')));
await p.screenshot({ path: 'qa/shots/loyalty-g1-2/cert-transfer/3-cert-list-after.png', fullPage: true });

console.log('ERRORS:', JSON.stringify(errs));
await b.close();
release();
