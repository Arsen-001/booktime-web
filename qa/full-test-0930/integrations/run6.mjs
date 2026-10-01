// QA 01.10 — integrations: закрытие раздела без права, ширина вкладок, подпись автора отзыва.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/integrations';
const log = (id, ok, note = '') => console.log(ok ? 'PASS' : 'FAIL', id, note);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
async function mk(persona, lang = 'ru') {
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.go = async (path) => {
    for (let i = 0; i < 3; i++) { try { await p.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=${persona}&lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 120000 }); break; } catch (e) { if (i === 2) throw e; } }
    await p.waitForTimeout(3000);
  };
  return p;
}
const body = (p) => p.locator('main').innerText().catch(() => p.locator('body').innerText());
const tabOverflow = (p) => p.evaluate(() => { const l = document.querySelector('main [role=tablist]'); return l ? l.scrollWidth - l.clientWidth : -1; });
try {
  const ONLY_REVIEW = true;
  const routes = ['/biz/integrations', '/biz/integrations/installed', '/biz/integrations/api?tab=identifiers', '/biz/integrations/apps/ia_12', '/biz/integrations/developers', '/biz/integrations/category/crm'];
  for (const persona of ONLY_REVIEW ? [] : ['admin', 'master']) {
    const p = await mk(persona);
    for (const r of routes) {
      await p.go(r);
      const t = await body(p);
      const denied = t.includes('Нет прав на это действие') && t.includes('Назад');
      log(`gate/${persona}${r}`, denied && !t.includes('biz_nuri') && !t.includes('ID бизнеса'), t.slice(0, 80).replace(/\n/g, ' / '));
    }
    await p.screenshot({ path: `${OUT}/gate-${persona}.png` });
    await p.getByRole('button', { name: 'Назад' }).click(); await p.waitForTimeout(2500);
    log(`gate/${persona}/back`, /\/biz(\/|\?|$)/.test(p.url()) && !p.url().includes('integrations'), p.url());
    await p.context().close();
  }
  const o = await mk('owner');
  for (const r of ONLY_REVIEW ? [] : routes) {
    await o.go(r);
    const t = await body(o);
    log(`owner${r}`, !t.includes('Нет прав на это действие') && t.length > 100, t.slice(0, 60).replace(/\n/g, ' / '));
  }
  // ширина вкладок API — ru/en
  await o.go('/biz/integrations/api?tab=keys');
  log('tabs/api-ru-1440', (await tabOverflow(o)) <= 1, `overflow ${await tabOverflow(o)}`);
  await o.screenshot({ path: `${OUT}/fix2-api-tabs-ru.png` });
  // приложение разработчика: создать, если нет
  await o.go('/biz/integrations/developers');
  let devHref = await o.locator('a[href*="/developers/apps/"]:not([href$="/new"])').first().getAttribute('href').catch(() => null);
  if (!devHref) {
    const t = await body(o);
    if (t.includes('Зарегистрироваться')) {
      await o.getByLabel(/Название компании/).fill('QA Студия'); await o.getByLabel(/Для чего/).fill('Тест');
      await o.getByLabel(/^Имя/).fill('Арсен'); await o.getByLabel(/Email/).fill('qa@example.com');
      await o.getByRole('checkbox', { name: /Согласен/ }).click();
      await o.getByRole('button', { name: 'Зарегистрироваться' }).click(); await o.waitForTimeout(2000);
    }
    await o.go('/biz/integrations/developers/apps/new');
    await o.getByLabel(/Название приложения/).fill(`QA Tabs ${Date.now() % 100000}`);
    await o.getByRole('button', { name: 'Создать', exact: true }).click();
    await o.waitForURL(/developers\/apps\/(?!new)/, { timeout: 60000 }); await o.waitForTimeout(2500);
    devHref = o.url().replace(BASE, '').split('?')[0];
  }
  await o.go(devHref);
  log('tabs/devapp-ru-1440', (await tabOverflow(o)) <= 1, `overflow ${await tabOverflow(o)} ${devHref}`);
  await o.screenshot({ path: `${OUT}/fix2-devapp-tabs-ru.png` });
  // отзыв: подключить → активировать → оставить отзыв
  await o.go('/biz/integrations/apps/ia_12');
  if (await o.getByRole('button', { name: 'Подключить', exact: true }).count()) {
    await o.getByRole('button', { name: 'Подключить', exact: true }).click(); await o.waitForTimeout(800);
    await o.locator('[role=dialog]').getByRole('button', { name: /Подключить/ }).last().click(); await o.waitForTimeout(1500);
  }
  const act = o.getByRole('button', { name: 'Партнёр активировал (демо)' });
  if (await act.count()) { await act.click(); await o.waitForTimeout(1500); }
  await o.getByRole('tab', { name: /Отзывы/ }).click(); await o.waitForTimeout(1000);
  await o.getByRole('button', { name: 'Оставить отзыв' }).click(); await o.waitForTimeout(600);
  await o.locator('[role=dialog] textarea').fill('QA: отзыв от владельца');
  await o.locator('[role=dialog]').getByRole('button', { name: 'Отправить отзыв' }).click(); await o.waitForTimeout(1500);
  const rv = await body(o);
  log('review/ru-author', rv.includes('QA: отзыв от владельца') && rv.includes('Владелец бизнеса'), '');
  await o.screenshot({ path: `${OUT}/fix2-review-ru.png` });
  const e = o;
  e.go = async (path) => { await e.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}demo=owner&lang=en`, { waitUntil: 'domcontentloaded', timeout: 120000 }); await e.waitForTimeout(3000); };
  await e.go('/biz/integrations/apps/ia_12');
  await e.getByRole('tab', { name: /Reviews/ }).click(); await e.waitForTimeout(1200);
  const ev = await body(e);
  log('review/en-author', ev.includes('Business owner') && !/Владелец|Сотрудник/.test(ev), '');
  await e.screenshot({ path: `${OUT}/fix2-review-en.png` });
  await e.go('/biz/integrations/api?tab=keys');
  log('tabs/api-en-1440', (await tabOverflow(e)) <= 1, `overflow ${await tabOverflow(e)}`);
  await e.go(devHref);
  log('tabs/devapp-en-1440', (await tabOverflow(e)) <= 1, `overflow ${await tabOverflow(e)}`);
  await e.screenshot({ path: `${OUT}/fix2-devapp-tabs-en.png` });
} catch (err) {
  console.error('SCRIPT ERROR', err);
} finally {
  console.log('DONE');
  await browser.close();
  release();
}
