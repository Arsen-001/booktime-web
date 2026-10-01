// QA 01.10 — «Ссылка для отзыва»: карточка по code, ?review=1, подсказка у черновика.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/integrations';
const log = (id, ok, note = '') => console.log(ok ? 'PASS' : 'FAIL', id, note);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const p = await ctx.newPage();
  const go = async (path, lang = 'ru') => { await p.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=owner&lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForTimeout(3000); };
  const main = () => p.locator('main').innerText();
  await go('/biz/integrations/apps/ia_12');
  const name = (await p.locator('main h1').innerText()).trim();
  await p.getByRole('button', { name: 'Скопировать ссылку' }).click(); await p.waitForTimeout(500);
  const link = await p.evaluate(() => navigator.clipboard.readText());
  const code = link.split('/e/')[1];
  console.log('catalog code', code, name);
  await go(`/biz/integrations/apps/${code}?review=1`);
  const t = await main();
  log('card-by-code', t.includes(name.split('\n').pop()) && !t.includes('Ссылка не найдена'), t.slice(0, 120).replace(/\n/g, ' / '));
  const sel = await p.getByRole('tab', { name: /Отзывы/ }).getAttribute('aria-selected');
  log('review=1 opens reviews tab', sel === 'true', `aria-selected=${sel}`);
  await p.screenshot({ path: `${OUT}/fix3-card-by-code.png` });
  await go('/biz/integrations/apps/no-such-code-xyz');
  log('unknown code → not found', (await main()).includes('Ссылка не найдена'), '');
  // черновик в кабинете разработчика
  // прямая ссылка /e/<code> ведёт на карточку
  await go(`/biz/integrations/e/${encodeURIComponent(code)}`);
  await p.waitForURL(/\/apps\//, { timeout: 30000 }).catch(() => {});
  log('direct link /e/<code> → card', p.url().includes('/biz/integrations/apps/'), p.url().slice(21, 70));
  await go('/biz/integrations/developers');
  if ((await main()).includes('Зарегистрироваться')) {
    await p.getByLabel(/Название компании/).fill('QA Студия'); await p.getByLabel(/Для чего/).fill('Тест');
    await p.getByLabel(/^Имя/).fill('Арсен'); await p.getByLabel(/Email/).fill('qa@example.com');
    await p.getByRole('checkbox', { name: /Согласен/ }).click();
    await p.getByRole('button', { name: 'Зарегистрироваться' }).click(); await p.waitForTimeout(2000);
  }
  await go('/biz/integrations/developers/apps/new');
  await p.getByLabel(/Название приложения/).fill(`QA Review ${Date.now() % 100000}`);
  await p.getByRole('button', { name: 'Создать', exact: true }).click();
  await p.waitForURL(/developers\/apps\/(?!new)/, { timeout: 60000 }); await p.waitForTimeout(2500);
  const href = p.url().replace(BASE, '').split('?')[0];
  await go(href);
  const g = await main();
  log('draft: hint instead of review link', g.includes('Ссылка заработает после публикации') && !g.includes('?review=1'), href);
  log('draft: links hint', g.includes('Ссылка на приложение работает в любом филиале') && !g.includes('Обе ссылки'), '');
  log('draft: app link still copyable', g.includes('/biz/integrations/e/'), '');
  await p.screenshot({ path: `${OUT}/fix3-draft-review-hint.png` });
  await go(href, 'en');
  log('draft hint en', (await main()).includes('The link will work after publication'), '');
} catch (e) { console.error('SCRIPT ERROR', e); } finally { console.log('DONE'); await browser.close(); release(); }
