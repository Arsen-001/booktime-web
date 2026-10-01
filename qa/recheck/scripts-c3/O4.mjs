import { start, stop, open, go, as, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online/widget');
await page.getByPlaceholder('https://apps.apple.com/…').fill('https://apps.apple.com/app/nuri-c3');
await page.getByRole('button', { name: 'Сохранить' }).last().click(); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
await as(page, 'guest', '/b/nuri-nail-studio/book');
const body = async () => (await page.locator('body').innerText());
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(800);
  if (await page.getByPlaceholder('Введите имя').count()) break;
  const und = page.getByRole('button', { name: 'Понятно' }); if (await und.count()) { await und.click(); await page.waitForTimeout(400); }
  const b = await body();
  if (await page.getByRole('button', { name: 'Индивидуальная запись' }).count()) { await page.getByRole('button', { name: 'Индивидуальная запись' }).click(); continue; }
  const time = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ });
  if (await time.count()) await time.first().click();
  else if (b.includes('Мариам Петросян')) await page.getByText('Мариам Петросян').first().click();
  else if (b.includes('Педикюр классический')) await page.getByText('Педикюр классический', { exact: true }).first().click();
  await page.waitForTimeout(300);
  const cont = page.getByRole('button', { name: /Продолжить/ }); if (await cont.count() && await cont.first().isEnabled()) await cont.first().click();
}
await page.getByPlaceholder('Введите имя').fill('Проверка');
await page.locator('main input[type=tel], main input[inputmode=tel]').first().fill('91 234 999');
await page.getByRole('button', { name: 'Получить код' }).click(); await page.waitForTimeout(1500);
await shot(page, 'O4-code');
const inputs = await page.locator('main input:visible').evaluateAll(a => a.map(x => (x.placeholder || x.type || '') + ':' + (x.getAttribute('inputmode')||'') + ':' + x.maxLength)); console.log('inputs', inputs);
const code = page.locator('main input:visible').filter({ hasNot: page.locator('xx') });
const ci = page.getByPlaceholder(/код|0000|••••/i).or(page.locator('input[autocomplete=one-time-code]')); console.log('code field', await ci.count());
if (await ci.count()) await ci.first().fill('0000'); 
const conf = page.getByRole('button', { name: /^Подтвердить$/ }); if (await conf.count()) { await conf.first().click(); await page.waitForTimeout(1200); }
const cbs = page.locator('main input[type=checkbox]'); for (let i = 0; i < await cbs.count(); i++) if (!(await cbs.nth(i).isChecked())) await cbs.nth(i).check().catch(()=>{});
const fb = page.getByRole('button', { name: /^Записаться$/ }).last(); await fb.click(); await page.waitForTimeout(3000);
const t = await body(); console.log('after:', t.replace(/\n/g, ' | ').slice(0, 600)); console.log('app link?', await page.locator('a[href*="apps.apple.com"]').count(), t.includes('App Store'));
await shot(page, 'O4-after', true);
await stop();
