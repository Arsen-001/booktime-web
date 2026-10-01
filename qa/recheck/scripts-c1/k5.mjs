import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/clients', { device: 'desktop' });
const seg = async () => (await text(page)).match(/Сегменты:[\s\S]*?(?=\n\t|Имя)/)?.[0].replace(/\n/g,' ');
log('before', await seg());
const lead = page.getByText(/Лиды из чата/).first();
await lead.click(); await page.waitForTimeout(1200);
log('after click lead chip', await seg(), '| body has switch?', (await text(page)).match(/[^\n]*чат[^\n]*/g)?.slice(0,6));
await shot(page, 'k5-leads');
const sw = page.getByRole('switch').first();
if (await sw.count()) { await sw.click(); await page.waitForTimeout(1200); log('switch toggled', await toast(page)); }
log('seg now', await seg());
const btn = page.getByRole('button', { name: /Новый собеседник/ });
log('lead btn', await btn.count(), await btn.first().isDisabled().catch(()=>null));
if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(1500); log('toast', await toast(page)); log('seg after lead', await seg()); await page.reload(); await settle(page); log('seg after reload', await seg()); }
// master persona perms
const { page: p2 } = await open('master', '/biz/clients', { device: 'desktop' });
const t2 = await text(p2);
log('master: add btn', await p2.getByRole('button', { name: 'Добавить клиента' }).count(), 'excel', await p2.getByRole('button', { name: /Операции с Excel/ }).count(), 'rows', await p2.locator('tbody tr').count(), t2.slice(0,300));
log('ERR', page.errors.slice(0,3), p2.errors.slice(0,3));
await stop();
