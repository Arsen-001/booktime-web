// QA 30.09 — integrations: API/вебхуки/MCP и кабинет разработчика действием.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/integrations';
const log = (id, ok, note = '') => console.log(ok ? 'PASS' : 'FAIL', id, note);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const errors = [];
async function newPage(persona = 'owner', device = 'desktop', extra = '') {
  const ctx = await browser.newContext(device === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror ${persona}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console ${persona}] ${m.text().slice(0, 200)}`); });
  const q = (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}demo=${persona.replace('-empty', '')}&empty=${persona.endsWith('-empty') ? 1 : 0}&lang=ru${extra}`;
  page.go = async (path) => { for (let i = 0; i < 3; i++) { try { await page.goto(q(path), { waitUntil: 'domcontentloaded', timeout: 120000 }); break; } catch (e) { if (i === 2) throw e; console.log('retry goto', path); } } await page.waitForTimeout(2000); };
  return page;
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
const text = (p) => p.locator('main').innerText().catch(() => p.locator('body').innerText());
async function toastText(p) { await p.waitForTimeout(700); return (await p.locator('[data-sonner-toast], [role=status]').allInnerTexts().catch(() => [])).join(' | ').replace(/\n/g, ' '); }
const dlg = (p) => p.locator('[role=alertdialog], [role=dialog]').last();

try {
  const p = await newPage('owner');
  await p.go('/biz/integrations/api');
  log('F-13-051', (await text(p)).length > 100, (await text(p)).slice(0, 200).replace(/\n/g, ' / '));
  await shot(p, 'api-overview');

  // ключи
  await p.getByRole('tab', { name: /Ключи/ }).click();
  await p.waitForTimeout(800);
  const revokeBtns = p.getByRole('button', { name: 'Отозвать' });
  if ((await p.getByText('Ключ ещё не выпущен').count()) === 0 && (await revokeBtns.count())) {
    await revokeBtns.first().click(); await p.waitForTimeout(400);
    await dlg(p).getByRole('button', { name: 'Отозвать' }).click();
    console.log('revoke existing partner key:', await toastText(p));
  }
  const issue = p.getByRole('button', { name: 'Выпустить' }).first();
  await issue.click();
  await p.waitForTimeout(800);
  const reveal = await dlg(p).innerText().catch(() => '');
  log('F-13-052', reveal.includes('Сохраните ключ'), reveal.slice(0, 160).replace(/\n/g, ' / '));
  await shot(p, 'api-key-reveal');
  await dlg(p).getByRole('button', { name: 'Я сохранил ключ' }).click();
  await p.waitForTimeout(600);
  // user token
  await p.getByPlaceholder('Название токена').fill('QA токен');
  await p.getByRole('button', { name: 'Выпустить' }).last().click();
  await p.waitForTimeout(800);
  await dlg(p).getByRole('button', { name: 'Я сохранил ключ' }).click().catch(() => {});
  await p.waitForTimeout(500);
  let t = await text(p);
  log('F-13-053', t.includes('QA токен'), 'user token listed');
  // reload persists
  await p.reload(); await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: /Ключи/ }).click(); await p.waitForTimeout(800);
  log('F-13-053/persist', (await text(p)).includes('QA токен'), 'after reload');
  // revoke token
  const row = p.locator('li', { hasText: 'QA токен' }).first();
  await row.getByRole('button', { name: 'Отозвать' }).click(); await p.waitForTimeout(400);
  await dlg(p).getByRole('button', { name: 'Отозвать' }).click();
  await p.waitForTimeout(800);
  log('F-13-053/revoke', !(await text(p)).includes('QA токен'), await toastText(p));
  await shot(p, 'api-keys');

  // идентификаторы
  await p.getByRole('tab', { name: /Идентификаторы|ID/ }).click(); await p.waitForTimeout(800);
  log('F-13-056', /\d{3,}/.test(await text(p)), (await text(p)).slice(0, 200).replace(/\n/g, ' / '));

  // вебхуки
  await p.getByRole('tab', { name: /Вебхуки/ }).click(); await p.waitForTimeout(1000);
  t = await text(p);
  log('F-13-062', t.includes('Отправлять хуки'), '');
  const sw = p.getByRole('switch').first();
  const before = await sw.getAttribute('aria-checked');
  await sw.click(); await p.waitForTimeout(800);
  const after = await sw.getAttribute('aria-checked');
  log('F-13-062/toggle', before !== after, `${before}→${after}`);
  await sw.click(); await p.waitForTimeout(600);
  const cb = p.getByRole('checkbox', { name: 'Абонементы' });
  const cb0 = await cb.getAttribute('aria-checked') ?? String(await cb.isChecked());
  await cb.click(); await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: /Вебхуки/ }).click(); await p.waitForTimeout(1000);
  const cb1 = await p.getByRole('checkbox', { name: 'Абонементы' }).getAttribute('aria-checked') ?? String(await p.getByRole('checkbox', { name: 'Абонементы' }).isChecked());
  log('F-13-063/persist', cb0 !== cb1, `${cb0}→${cb1}`);
  await p.getByRole('checkbox', { name: 'Абонементы' }).click(); await p.waitForTimeout(500);
  // адрес
  t = await text(p);
  console.log('WEBHOOK ADDRESSES:', t.slice(t.indexOf('Адреса'), t.indexOf('Адреса') + 500).replace(/\n/g, ' / '));
  const addBtn = p.getByRole('button', { name: /Добавить адрес/ });
  if (await addBtn.count()) {
    await addBtn.first().click(); await p.waitForTimeout(600);
    await shot(p, 'webhook-add');
    const inp = dlg(p).locator('input').first();
    await inp.fill('http://not-https');
    await dlg(p).getByRole('button', { name: /Добавить|Сохранить|Проверить/ }).last().click(); await p.waitForTimeout(800);
    console.log('invalid url dialog:', (await dlg(p).innerText().catch(() => 'closed')).slice(0, 300).replace(/\n/g, ' / '));
    await inp.fill('https://example.com/hook-qa').catch(() => {});
    await dlg(p).getByRole('button', { name: /Добавить|Сохранить|Проверить/ }).last().click().catch(() => {}); await p.waitForTimeout(1500);
    console.log('add url toast:', await toastText(p));
    await dlg(p).getByRole('button', { name: /Готово|Закрыть|Я сохранил/ }).first().click().catch(() => {});
    await p.waitForTimeout(600);
    log('F-13-065', (await text(p)).includes('example.com/hook-qa'), '');
    await shot(p, 'webhooks');
  } else log('F-13-065', false, 'no add address button');
  // журнал доставок: повторить
  const retry = p.getByRole('button', { name: /Повторить|Отправить ещё/ });
  console.log('retry buttons', await retry.count());
  if (await retry.count()) { await retry.first().click(); console.log('retry toast', await toastText(p)); }

  // MCP
  await p.getByRole('tab', { name: /MCP/ }).click(); await p.waitForTimeout(1000);
  t = await text(p);
  console.log('MCP:', t.slice(0, 500).replace(/\n/g, ' / '));
  const mcpIssue = p.getByRole('button', { name: /Выпустить|Создать токен|Получить/ });
  if (await mcpIssue.count()) {
    await mcpIssue.first().click(); await p.waitForTimeout(900);
    const d = await dlg(p).innerText().catch(() => '');
    log('F-13-071', d.length > 0, d.slice(0, 200).replace(/\n/g, ' / '));
    await shot(p, 'mcp-issued');
    await dlg(p).getByRole('button').last().click().catch(() => {});
  } else log('F-13-071', false, 'no MCP issue button');
  await p.getByRole('tab', { name: /Документация/ }).click(); await p.waitForTimeout(800);
  log('F-13-058', (await text(p)).length > 300, (await text(p)).slice(0, 150).replace(/\n/g, ' / '));
  await shot(p, 'api-docs');
  await p.go('/biz/integrations/api/status');
  log('F-13-054', (await text(p)).length > 50, (await text(p)).slice(0, 200).replace(/\n/g, ' / '));

  // телефон: вкладки api
  const ph = await newPage('owner', 'phone');
  await ph.go('/biz/integrations/api?tab=webhooks');
  await shot(ph, 'phone-api-webhooks');
  const sw2 = await ph.evaluate(() => document.documentElement.scrollWidth);
  log('phone/api-overflow', sw2 <= 391, `scrollWidth ${sw2}`);
  await ph.go('/biz/integrations');
  await shot(ph, 'phone-hub');
  await ph.go('/biz/integrations/installed');
  await shot(ph, 'phone-installed');
  await ph.context().close();

  // ── кабинет разработчика
  await p.go('/biz/integrations/developers');
  t = await text(p);
  console.log('DEV HUB:', t.slice(0, 400).replace(/\n/g, ' / '));
  await shot(p, 'dev-hub');
  if (t.includes('Зарегистрироваться')) {
    await p.getByRole('checkbox', { name: /Согласен/ }).click();
    await p.getByRole('button', { name: 'Зарегистрироваться' }).click(); await p.waitForTimeout(500);
    const errs = await p.getByText('Заполните это поле').count();
    log('F-13-028/validation', errs >= 3, `errors ${errs}`);
    await p.getByLabel(/Название компании/).fill('QA Студия');
    await p.getByLabel(/Для чего/).fill('Тест');
    await p.getByLabel(/^Имя/).fill('Арсен');
    await p.getByLabel(/Email/).fill('qa@example.com');
    await p.getByRole('button', { name: 'Зарегистрироваться' }).click();
    log('F-13-028', /создан/.test(await toastText(p)), '');
    await p.waitForTimeout(1000);
  }
  await p.go('/biz/integrations/developers/apps/new');
  await p.getByRole('button', { name: 'Создать', exact: true }).click(); await p.waitForTimeout(500);
  console.log('new app empty submit:', (await text(p)).includes('Заполните') || (await text(p)).toLowerCase().includes('назван'), (await toastText(p)));
  await p.getByLabel(/Название приложения/).fill('!!!');
  await p.getByRole('button', { name: 'Создать', exact: true }).click(); await p.waitForTimeout(700);
  const codeVal = await p.getByLabel(/ID приложения/).inputValue().catch(() => '?');
  console.log(`name "!!!" → code "${codeVal}", url ${p.url()}, toast ${await toastText(p)}`);
  await shot(p, 'dev-new-bang');
  await p.getByLabel(/Название приложения/).fill('Моё приложение QA');
  const code2 = await p.getByLabel(/ID приложения/).inputValue();
  console.log('code for cyrillic', code2);
  await p.getByRole('button', { name: 'Создать', exact: true }).click();
  await p.waitForTimeout(2000);
  log('F-13-030', /developers\/apps\/(?!new)/.test(p.url()), p.url());
  await shot(p, 'dev-app-detail');
  const devUrl = p.url().replace(BASE, '').split('?')[0];
  // вкладки
  for (const tab of ['О приложении', 'Настройки для разработки', 'Доступ к API', 'Монетизация', 'Публикация', 'Общая информация']) {
    const tb = p.getByRole('tab', { name: tab });
    if (!(await tb.count())) { console.log('NO TAB', tab); continue; }
    await tb.click(); await p.waitForTimeout(700);
    console.log(`TAB ${tab}:`, (await text(p)).slice(0, 250).replace(/\n/g, ' / '));
    const save = p.getByRole('button', { name: /^Сохранить/ });
    if (await save.count()) { await save.first().click(); console.log('  save →', await toastText(p)); }
    await shot(p, `dev-tab-${tab.replace(/\s/g, '_')}`);
  }
  const submitRev = p.getByRole('button', { name: 'Отправить на модерацию' });
  if (await submitRev.count()) {
    const dis = await submitRev.isDisabled();
    await submitRev.click().catch(() => {});
    console.log('submit review disabled?', dis, await toastText(p));
  }
  // второй аккаунт — не видит кабинет
  const pa = await newPage('admin');
  await pa.go('/biz/integrations/developers');
  console.log('ADMIN dev hub:', (await text(pa)).slice(0, 300).replace(/\n/g, ' / '));
  await pa.go(devUrl);
  console.log('ADMIN dev app:', (await text(pa)).slice(0, 200).replace(/\n/g, ' / '));
  await pa.context().close();
} catch (e) {
  console.error('SCRIPT ERROR', e);
} finally {
  console.log('\nERRORS:\n' + [...new Set(errors)].join('\n'));
  await browser.close();
  release();
}
