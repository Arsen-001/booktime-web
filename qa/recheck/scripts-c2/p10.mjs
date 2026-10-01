import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/support', { device: 'desktop' });
let t = await text(page); console.log('SUPPORT', t.slice(0,600).replace(/\n/g,' | '));
const counts = () => text(page).then(x => x.match(/(Открыт[^\n]*\n\d+|Ждут[^\n]*\n\d+|Закрыт[^\n]*\n\d+)/g)?.join(' ; ').replace(/\n/g,' '));
console.log('counts', await counts());
await page.getByRole('row').nth(1).click().catch(async()=>{ await page.locator('main li, main tr').nth(1).click(); }); await page.waitForTimeout(1000);
const dlg = page.locator('[role=dialog]').last(); console.log('DLG', (await dlg.innerText().catch(()=>'none')).replace(/\n+/g,' | ').slice(0,400));
const close = dlg.getByRole('radio', { name: /Закрыт/ }).or(dlg.getByRole('button', { name: /Закрыть обращение|Закрыт/ })); console.log('close ctrl', await close.count());
if (await close.count()) { await close.first().click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page)); }
await page.keyboard.press('Escape'); await reload(page); console.log('counts after reload', await counts());
await stop();
