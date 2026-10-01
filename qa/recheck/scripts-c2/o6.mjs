import { start, stop, open, as, reload, text, shot, db, toasts, pick, wizardToDetails } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/online`, { device: 'desktop' });
let d = await db(page); const l = d.areas.online.links.find(x=>x.businessId==='biz_nuri' && x.primary);
const url = `/biz/online/links/${l.id}`; await as(page, 'owner', url);
const sec = (title) => page.locator('section, [data-f], div').filter({ has: page.getByText(title, { exact: true }) });
// preselect Ани + hide step
const combos = page.getByRole('combobox'); const ct = await combos.allInnerTexts(); console.log('combos', ct);
await pick(page, combos.nth(1), 'Ани Саргсян');
await page.getByRole('switch', { name: /Скрыть шаг выбора сотрудника/ }).click().catch(async()=>{ await page.getByText('Скрыть шаг выбора сотрудника').click(); });
await page.getByRole('button', { name: 'Сохранить' }).nth(0).click(); await page.waitForTimeout(1500); console.log('save1', await toasts(page));
await page.getByText('Скрыть цену услуг в виджете').click(); await page.getByText('Скрыть длительность услуг в виджете').click();
await page.getByLabel(/Текст кнопки/).fill('Хочу записаться');
await page.getByText('Тёмная', { exact: true }).click();
await page.getByRole('button', { name: 'Сохранить' }).nth(1).click(); await page.waitForTimeout(1500); console.log('save2', await toasts(page));
// low contrast
console.log('url', page.url(), 'inputs', await page.locator('input').evaluateAll(els=>els.map(e=>e.value).filter(Boolean))); const hex = page.locator('input').filter({ hasNot: page.locator('xx') }).and(page.locator('[value^="#"]')).first(); await hex.fill('#f5f5f0'); await page.waitForTimeout(500);
console.log('hex error', (await text(page)).match(/[^\n]*контраст[^\n]*/)?.[0]);
await page.getByRole('button', { name: 'Сохранить' }).nth(1).click(); await page.waitForTimeout(1500); console.log('save3', await toasts(page));
await reload(page); console.log('hex after reload', await page.locator('input').evaluateAll(els=>els.map(e=>e.value).filter(v=>v.startsWith('#')).join()), 'switches', await page.getByRole('switch').evaluateAll(els=>els.map(e=>e.getAttribute('aria-checked')).join(',')));
d = await db(page); const l2 = d.areas.online.links.find(x=>x.id===l.id); console.log('link now', JSON.stringify({ staffId: l2.staffId, pre: l2.preselectedStaffId, hidden: l2.stepHidden, hp: l2.hidePrice, hd: l2.hideDuration, btn: l2.bookButtonText ?? l2.buttonText, theme: l2.theme, color: l2.widgetButtonColor }));
// guest flow
await as(page, 'guest', '/b/nuri-nail-studio/book');
if (await page.getByRole('button', { name: 'Индивидуальная запись' }).count()) { await page.getByRole('button', { name: 'Индивидуальная запись' }).click(); await page.waitForTimeout(800); }
const t1 = await text(page); console.log('FIRST STEP', t1.slice(0,500).replace(/\n/g,' | '));
console.log('prices shown', /\d[\d ]* ֏/.test(t1), 'duration shown', /\d+ мин|\d+ ч/.test(t1), 'dark?', await page.evaluate(()=>document.querySelector('[data-f*="F-03-023"]')?.className + ' ' + getComputedStyle(document.querySelector('[data-f*="F-03-023"]')||document.body).backgroundColor));
await shot(page, 'o6-guest-first-step');
await wizardToDetails(page, { staff: null });
const t2 = await text(page); console.log('DETAILS', t2.slice(0,500).replace(/\n/g,' | '), '| button', (await page.getByRole('button', { name: /записаться/i }).allInnerTexts()));
await stop();
