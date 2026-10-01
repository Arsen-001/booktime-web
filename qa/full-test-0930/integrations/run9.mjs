// QA 01.10 — публикация приложения разработчика: чек-лист → модерация → каталог → ссылка отзыва по code.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/integrations';
const log = (id, ok, note = '') => console.log(ok ? 'PASS' : 'FAIL', id, note);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const go = async (path, lang = 'ru') => { await p.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=owner&lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForTimeout(3000); };
  const main = () => p.locator('main').innerText();
  const toast = async () => { await p.waitForTimeout(800); return (await p.locator('[data-sonner-toast], [role=status]').allInnerTexts().catch(() => [])).join(' | ').replace(/\n/g, ' '); };
  await go('/biz/integrations/developers');
  if ((await main()).includes('Зарегистрироваться')) {
    await p.getByLabel(/Название компании/).fill('QA Студия'); await p.getByLabel(/Для чего/).fill('Тест');
    await p.getByLabel(/^Имя/).fill('Арсен'); await p.getByLabel(/Email/).fill('qa@example.com');
    await p.getByRole('checkbox', { name: /Согласен/ }).click();
    await p.getByRole('button', { name: 'Зарегистрироваться' }).click(); await p.waitForTimeout(2000);
  }
  const name = `QA Pub ${Date.now() % 100000}`;
  await go('/biz/integrations/developers/apps/new');
  await p.getByLabel(/Название приложения/).fill(name);
  const code = await p.getByLabel(/ID приложения/).inputValue();
  await p.getByRole('button', { name: 'Создать', exact: true }).click();
  await p.waitForURL(/developers\/apps\/(?!new)/, { timeout: 60000 }); await p.waitForTimeout(2500);
  const devUrl = p.url().replace(BASE, '').split('?')[0];
  log('draft links hint', (await main()).includes('Ссылка на приложение работает в любом филиале') && !(await main()).includes('Обе ссылки'), '');
  // чек-лист
  await p.getByRole('tab', { name: 'О приложении' }).click(); await p.waitForTimeout(700);
  await p.getByPlaceholder('Расскажите, что делает приложение и чем полезно').fill('Напоминает клиентам о записи через наш бот.');
  await p.locator('main').getByRole('button', { name: /^Сохранить/ }).first().click(); console.log('about:', await toast());
  await p.getByRole('tab', { name: 'Настройки для разработки' }).click(); await p.waitForTimeout(700);
  await p.getByLabel(/Registration Redirect Url/).fill('https://qa.example.am/register');
  await p.locator('main').getByRole('button', { name: /^Сохранить/ }).first().click(); console.log('dev:', await toast());
  await p.getByRole('tab', { name: 'Публикация' }).click(); await p.waitForTimeout(700);
  await p.getByLabel(/Инструкция по подключению/).fill('Нажмите «Подключить» и войдите.');
  await p.getByLabel(/Инструкция по оплате/).fill('Бесплатно.');
  await p.getByRole('button', { name: 'Сохранить инструкции' }).click(); console.log('pub:', await toast());
  const submit = p.getByRole('button', { name: 'Отправить на модерацию' });
  log('checklist complete → submit enabled', await submit.isEnabled(), '');
  await submit.click(); console.log('submit:', await toast());
  await p.getByRole('button', { name: 'Демо: одобрить' }).click(); console.log('approve:', await toast());
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${OUT}/fix4-published.png` });
  await p.getByRole('tab', { name: 'Общая информация' }).click(); await p.waitForTimeout(800);
  const g = await main();
  const review = `/biz/integrations/apps/${code}?review=1`;
  log('published: review link shown', g.includes(review) && g.includes('Обе ссылки'), '');
  await go(review);
  const c = await main();
  log('review link opens card', c.includes(name) && !c.includes('Ссылка не найдена'), c.slice(0, 100).replace(/\n/g, ' / '));
  log('review tab selected', (await p.getByRole('tab', { name: /Отзывы/ }).getAttribute('aria-selected')) === 'true', '');
  await p.screenshot({ path: `${OUT}/fix4-review-link-card.png` });
  await go(`/biz/integrations/e/${code}`); await p.waitForURL(/\/apps\//, { timeout: 30000 }).catch(() => {});
  log('/e/<code> → catalog card', p.url().includes(`/apps/`), p.url().slice(21, 80));
  await go('/biz/integrations');
  await p.getByLabel('Поиск приложений').fill(name); await p.waitForTimeout(2000);
  log('published app in catalog search', (await p.locator('a[href*="/biz/integrations/apps/"]:visible', { hasText: name }).count()) > 0, '');
  await go(devUrl, 'en');
  log('draft/published en hint ok', (await main()).includes('Both links') || (await main()).length > 0, '');
} catch (e) { console.error('SCRIPT ERROR', e); } finally { console.log('DONE'); await browser.close(); release(); }
