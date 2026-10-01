// QA 30.09 — integrations: основные сценарии действием. node qa/full-test-0930/integrations/run1.mjs
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/integrations';
const results = [];
const log = (id, ok, note = '') => { results.push({ id, ok, note }); console.log(ok ? 'PASS' : 'FAIL', id, note); };

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
async function toastText(p) { await p.waitForTimeout(600); return (await p.locator('[data-sonner-toast], [role=status], [role=alert]').allInnerTexts().catch(() => [])).join(' | '); }

try {
  // ── 1. Витрина, поиск
  const p = await newPage('owner');
  await p.go('/biz/integrations');
  let t = await text(p);
  log('F-13-001', t.includes('Интеграции') && t.includes('Начните с этого'), 'hub');
  await shot(p, 'hub-desktop');
  const chips = await p.getByRole('button').allInnerTexts();
  log('F-13-004', chips.length >= 5, `chips: ${chips.map((c) => c.replace(/\n/g, ' ')).join(', ')}`);
  const search = p.getByLabel('Поиск приложений');
  await search.fill('sms');
  await p.waitForTimeout(1500);
  t = await text(p);
  const smsTiles = await p.locator('a[href*="/biz/integrations/apps/"]:visible').count();
  log('F-13-002', smsTiles > 0, `search sms → ${smsTiles} tiles`);
  await shot(p, 'search-sms');
  await search.fill('zzqqxx');
  await p.waitForTimeout(1500);
  t = await text(p);
  log('F-13-002/empty', t.includes('Ничего не нашли'), 'empty search: ' + t.slice(0,300).replace(/\n/g,' / ')); await shot(p, 'search-empty');
  await search.fill('');
  await p.waitForTimeout(800);

  // все ссылки приложений
  const hrefs = [...new Set(await p.locator('a[href*="/biz/integrations/apps/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href'))))];
  console.log('apps on hub', hrefs.length, hrefs.slice(0, 40).join(' '));

  // ── 2. Категории
  const cats = ['notifications','telephony','marketing','social','widgets','analytics','accounting','maps','payments','fiscal','aiAssistants','crm','personnel','other','chatbots','tips','zzz'];
  for (const c of cats) {
    await p.go(`/biz/integrations/category/${c}`);
    const tt = await text(p);
    const n = await p.locator('a[href*="/biz/integrations/apps/"]').count();
    console.log('category', c, 'tiles', n, tt.slice(0, 80).replace(/\n/g, ' / '));
    if (c === 'zzz' || c === 'payments' || c === 'chatbots') await shot(p, `cat-${c}`);
  }
  // все приложения по категориям
  const catLinks = cats.filter((c) => c !== 'zzz').map((c) => `/biz/integrations/category/${c}`);
  console.log('cat links', [...new Set(catLinks)].join(' '));

  // ── 3. Подключение приложения (первое обычное с кнопкой «Подключить»)
  const allApps = new Set();
  for (const c of [...new Set(catLinks)]) {
    await p.goto(`${BASE}${c.split('?')[0]}?demo=owner&lang=ru`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    for (const h of await p.locator('a[href*="/biz/integrations/apps/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) allApps.add(h.split('?')[0]);
  }
  console.log('ALL APPS', allApps.size, [...allApps].join(' '));
  let connectedApp = null;
  for (const h of allApps) {
    await p.go(h);
    const btn = p.getByRole('button', { name: 'Подключить', exact: true });
    if (await btn.count()) {
      connectedApp = h;
      break;
    }
  }
  log('F-13-008', Boolean(connectedApp), `first connectable ${connectedApp}`);
  if (connectedApp) {
    await shot(p, 'app-card');
    await p.getByRole('button', { name: 'Подключить', exact: true }).click();
    await p.waitForTimeout(800);
    const sheet = await p.locator('[role=dialog]').innerText().catch(() => '');
    log('F-13-014', sheet.includes('Подключить') || sheet.length > 50, sheet.slice(0, 200).replace(/\n/g, ' / '));
    await shot(p, 'connect-sheet');
    await p.locator('[role=dialog]').getByRole('button', { name: /Подключить|Продолжить/ }).last().click();
    const toast = await toastText(p);
    log('F-13-014/toast', /заявк|подключ/i.test(toast), toast);
    await p.waitForTimeout(800);
    t = await text(p);
    const pendingVisible = t.includes('Отменить подключение') || t.includes('Партнёр активировал');
    log('F-13-018', pendingVisible, 'pending after connect');
    await shot(p, 'app-pending');
    // Установлено
    await p.go('/biz/integrations/installed');
    t = await text(p);
    const appName = connectedApp.split('/').pop();
    log('F-13-007', (await p.locator(`a[href*="${appName}"]`).count()) > 0 || t.includes('Ждём'), 'installed shows pending app');
    await shot(p, 'installed');
    // демо-активация
    await p.go(connectedApp);
    const act = p.getByRole('button', { name: 'Партнёр активировал (демо)' });
    if (await act.count()) {
      await act.click();
      log('F-13-018/activate', /подключено/i.test(await toastText(p)), '');
      await p.waitForTimeout(800);
      const hasSettings = await p.getByRole('tab', { name: 'Настройки' }).count();
      console.log('settings tab', hasSettings);
      await shot(p, 'app-connected');
      // отзыв
      await p.getByRole('tab', { name: /Отзывы/ }).click();
      await p.waitForTimeout(600);
      t = await text(p);
      console.log('REVIEWS TAB', t.slice(0, 600).replace(/\n/g, ' / '));
      await shot(p, 'reviews');
      // отключить
      await p.getByRole('button', { name: 'Отключить', exact: true }).first().click();
      await p.waitForTimeout(500);
      await shot(p, 'disconnect-confirm');
      await p.locator('[role=alertdialog], [role=dialog]').getByRole('button', { name: 'Отключить' }).click();
      log('F-13-020', /отключено/i.test(await toastText(p)), '');
      await p.waitForTimeout(800);
      log('F-13-020/button-back', (await p.getByRole('button', { name: 'Подключить', exact: true }).count()) > 0, '');
    } else log('F-13-018/activate', false, 'no demo activate button');
  }

  // ── 4. Роли: мастер / админ
  for (const persona of ['admin', 'master']) {
    const pp = await newPage(persona);
    await pp.go(connectedApp ?? '/biz/integrations');
    const tt = await text(pp);
    const canBtn = await pp.getByRole('button', { name: 'Подключить', exact: true }).count();
    console.log(`ROLE ${persona}: connect=${canBtn}`, tt.slice(0, 300).replace(/\n/g, ' / '));
    await shot(pp, `role-${persona}-app`);
    await pp.go('/biz/integrations/api');
    console.log(`ROLE ${persona} api:`, (await text(pp)).slice(0, 200).replace(/\n/g, ' / '));
    await shot(pp, `role-${persona}-api`);
    await pp.context().close();
  }

  // ── 5. Пусто / ошибка / медленно
  const pe = await newPage('owner-empty');
  await pe.go('/biz/integrations/installed');
  console.log('EMPTY installed:', (await text(pe)).slice(0, 200).replace(/\n/g, ' / '));
  await shot(pe, 'empty-installed');
  await pe.go('/biz/integrations/api');
  console.log('EMPTY api:', (await text(pe)).slice(0, 300).replace(/\n/g, ' / '));
  await shot(pe, 'empty-api');
  await pe.go('/biz/integrations/developers');
  console.log('EMPTY dev:', (await text(pe)).slice(0, 300).replace(/\n/g, ' / '));
  await pe.context().close();
  const pErr = await newPage('owner', 'desktop', '&api=error');
  for (const r of ['/biz/integrations', '/biz/integrations/installed', '/biz/integrations/api', '/biz/integrations/developers', connectedApp]) {
    await pErr.go(r);
    await pErr.waitForTimeout(2500);
    const tt = await text(pErr);
    console.log('ERROR', r, /Повторить|ошибк/i.test(tt), tt.slice(0, 120).replace(/\n/g, ' / '));
  }
  await shot(pErr, 'error-app');
  await pErr.context().close();
} catch (e) {
  console.error('SCRIPT ERROR', e);
} finally {
  console.log('\nERRORS:\n' + [...new Set(errors)].join('\n'));
  await browser.close();
  release();
}
