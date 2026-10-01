// QA 30.09 — integrations: перепроверка починок + вебхук-адрес + отзыв.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/integrations';
const log = (id, ok, note = '') => console.log(ok ? 'PASS' : 'FAIL', id, note);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
async function mk(extra = '', vp = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const p = await ctx.newPage();
  p.go = async (path) => { for (let i = 0; i < 3; i++) { try { await p.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=owner&lang=ru${extra}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); break; } catch (e) { if (i === 2) throw e; } } await p.waitForTimeout(2500); };
  return p;
}
const text = (p) => p.locator('main').innerText().catch(() => '');
const toast = async (p) => { await p.waitForTimeout(700); return (await p.locator('[data-sonner-toast], [role=status]').allInnerTexts().catch(() => [])).join(' | ').replace(/\n/g, ' '); };
try {
  const e = await mk('&api=error');
  await e.go('/biz/integrations/api');
  for (const tab of ['Ключи', 'Идентификаторы', 'Вебхуки', 'MCP']) {
    await e.getByRole('tab', { name: new RegExp(tab) }).click(); await e.waitForTimeout(2500);
    const t = await text(e);
    log(`error/${tab}`, t.includes('Повторить'), t.slice(0, 200).replace(/\n/g, ' / '));
  }
  await e.screenshot({ path: `${OUT}/fix-error-mcp.png` });
  await e.context().close();

  const p = await mk();
  await p.go('/biz/integrations/api?tab=keys');
  await p.screenshot({ path: `${OUT}/fix-api-tabs-desktop.png` });
  const tabsOverflow = await p.evaluate(() => { const l = document.querySelector('[role=tablist]'); return l ? l.scrollWidth - l.clientWidth : -1; });
  log('fix/api-tabs-fit', tabsOverflow <= 1, `tablist overflow ${tabsOverflow}px`);
  // вебхук-адрес
  await p.getByRole('tab', { name: /Вебхуки/ }).click(); await p.waitForTimeout(1500);
  const inp = p.getByPlaceholder('https://example.am/hooks/booking');
  await inp.fill('http://plain-http.am/x');
  await p.getByRole('button', { name: 'Проверить и добавить' }).click(); await p.waitForTimeout(800);
  const err = await text(p);
  log('F-13-065/invalid', /https/i.test(err.slice(err.indexOf('Новый адрес'), err.indexOf('Новый адрес') + 300)), '');
  await inp.fill(`https://qa-${Date.now()}.example.am/hook`);
  await p.getByRole('button', { name: 'Проверить и добавить' }).click(); await p.waitForTimeout(2500);
  const dlgT = await p.locator('[role=dialog]').innerText().catch(() => '');
  console.log('add hook →', await toast(p), '| dialog:', dlgT.slice(0, 150).replace(/\n/g, ' / '));
  await p.screenshot({ path: `${OUT}/webhook-added.png` });
  await p.locator('[role=dialog]').getByRole('button', { name: 'Я сохранил ключ' }).click().catch(() => {});
  await p.waitForTimeout(800);
  log('F-13-065', (await text(p)).includes('.example.am/hook'), 'address listed');
  // новое приложение разработчика: пустой ID
  await p.go('/biz/integrations/developers/apps/new');
  await p.getByLabel(/Название приложения/).fill('!!!');
  await p.getByRole('button', { name: 'Создать', exact: true }).click(); await p.waitForTimeout(800);
  log('fix/dev-empty-code', (await text(p)).includes('Введите ID латиницей'), '');
  await p.screenshot({ path: `${OUT}/fix-dev-empty-code.png` });
  const nm = `QA App ${Date.now() % 100000}`;
  await p.getByLabel(/Название приложения/).fill(nm);
  await p.getByRole('button', { name: 'Создать', exact: true }).click();
  await p.waitForURL(/developers\/apps\/(?!new)/, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(2000);
  log('F-13-030', /developers\/apps\/(?!new)/.test(p.url()), p.url());
  const tabs = await p.getByRole('tab').allInnerTexts();
  console.log('dev app tabs:', tabs.join(', '));
  await p.screenshot({ path: `${OUT}/dev-app-detail.png` });
  for (const tb of tabs.slice(1)) {
    await p.getByRole('tab', { name: tb.trim() }).first().click(); await p.waitForTimeout(900);
    const save = p.locator('main').getByRole('button', { name: /^Сохранить/ });
    let st = '';
    if (await save.count()) { await save.first().click(); st = await toast(p); }
    console.log(`TAB ${tb.trim()}: save→ ${st} ::`, (await text(p)).slice(0, 160).replace(/\n/g, ' / '));
  }
  const sub = p.getByRole('button', { name: 'Отправить на модерацию' });
  if (await sub.count()) console.log('submit review enabled?', await sub.isEnabled());
  // несуществующее приложение
  await p.go('/biz/integrations/apps/ia_nope');
  log('fix/app-not-found', (await text(p)).includes('Ссылка не найдена'), (await text(p)).slice(0, 120).replace(/\n/g, ' / '));
  // сброс поиска
  await p.go('/biz/integrations');
  await p.getByLabel('Поиск приложений').fill('zzqqxx'); await p.waitForTimeout(1800);
  const reset = p.getByRole('button', { name: /Сбросить/ });
  log('fix/search-reset-visible', (await reset.count()) > 0, '');
  if (await reset.count()) { await reset.first().click(); await p.waitForTimeout(1200); log('fix/search-reset-works', (await p.getByLabel('Поиск приложений').inputValue()) === '' && (await text(p)).includes('Начните с этого'), ''); }
  // неизвестная категория
  await p.go('/biz/integrations/category/zzz');
  await p.screenshot({ path: `${OUT}/fix-cat-404.png` });
  log('fix/category-404', !(await text(p)).includes('Не удалось загрузить'), (await p.locator('body').innerText()).slice(0, 120).replace(/\n/g, ' / '));
  // en язык — хаб и API
  await p.goto(`${BASE}/biz/integrations/api?demo=owner&lang=en`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/en-api.png` });
  const enOv = await p.evaluate(() => { const l = document.querySelector('[role=tablist]'); return l ? l.scrollWidth - l.clientWidth : -1; });
  console.log('EN api tabs overflow', enOv, (await text(p)).slice(0, 200).replace(/\n/g, ' / '));
  // телефон
  const ph = await mk('', { width: 390, height: 844 });
  await ph.go('/biz/integrations/apps/ia_12');
  await ph.screenshot({ path: `${OUT}/phone-app.png` });
  log('phone/app-overflow', (await ph.evaluate(() => document.documentElement.scrollWidth)) <= 391, '');
  await ph.go('/biz/integrations');
  await ph.screenshot({ path: `${OUT}/phone-hub.png` });
} catch (err) {
  console.error('SCRIPT ERROR', err);
} finally {
  console.log('DONE');
  await browser.close();
  release();
}
