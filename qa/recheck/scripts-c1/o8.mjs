import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/online', { device: 'desktop' });
async function create(kind, name, opts = {}) {
  await page.getByRole('button', { name: 'Новая ссылка' }).click(); await page.waitForTimeout(1000);
  const dlg = page.locator('[role=dialog]').last();
  if (kind === 'staff') { await dlg.getByText('Ссылку для сотрудника').click(); await page.waitForTimeout(300); await dlg.locator('select').first().selectOption({ label: 'Ани Саргсян' }); }
  await dlg.getByLabel(/Название ссылки/).fill(name);
  if (opts.group) await dlg.locator('select').filter({ has: page.locator('option[value=group]') }).selectOption('group');
  await dlg.getByRole('button', { name: 'Создать' }).click(); await page.waitForTimeout(2000);
  log('create', name, await toast(page));
}
await create('staff', 'Ссылка Ани');
await create('normal', 'Только группы', { group: true });
log('--- list\n' + (await text(page)).split('Для «Nuri Nail Studio»')[1]?.slice(0, 1200));
await page.reload(); await settle(page);
const d = await db(page);
const links = d.areas.online.links.filter(l=>l.businessId==='biz_nuri');
log('links after reload', JSON.stringify(links.map(l=>[l.name,l.kind,l.bookingType,l.staffId,l.formId,l.primary])));
const listTxt = await text(page);
const urls = [...listTxt.matchAll(/localhost:3710(\/b\/[^\s]+)/g)].map(m=>m[1]);
log('urls', urls);
// open staff link and group link
for (const u of urls.slice(1)) {
  await go(page, u + '?demo=guest');
  log('--- guest opens', u, '\n', (await text(page)).slice(0, 700).replace(/\n/g,' | '));
  const btn = page.getByRole('link', { name: /Записаться/ }).or(page.getByRole('button', { name: /Записаться/ }));
  if (await btn.count()) { await btn.first().click(); await settle(page); log('  after Записаться', page.url(), (await text(page)).slice(0, 600).replace(/\n/g,' | ')); }
}
// delete additional link + main
await go(page, '/biz/online?demo=owner');
log('--- owner list\n', (await text(page)).split('Для «Nuri Nail Studio»')[1]?.slice(0, 600).replace(/\n/g,' | '));
await shot(page, 'o8-list', true);
log('ERR', page.errors.slice(0,3));
await stop();
