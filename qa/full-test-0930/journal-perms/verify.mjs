// Проверка прав журнала (qa/full-test-0930/journal-perms.md): мастер / владелец / администратор × телефон / десктоп
import { chromium } from '/Users/arsen/WebstormProjects/booking-platform/node_modules/playwright/index.mjs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-perms';
const personas = (process.argv[2] ?? 'master,owner,admin').split(',');
const devices = (process.argv[3] ?? 'phone,desktop').split(',');
const FOREIGN = process.env.FOREIGN ?? 'bk_2385';
const waitReady = async (p) => { for (let i = 0; i < 40; i++) { const busy = await p.evaluate(() => document.querySelectorAll('[aria-busy="true"]').length).catch(() => 1); if (!busy) break; await p.waitForTimeout(400); } await p.waitForTimeout(700); };
const dlg = (p) => p.evaluate(() => { const ds = [...document.querySelectorAll('[role=dialog]')].filter((d) => d.getClientRects().length); return ds.map((d) => d.innerText).join('\n-----\n'); });
const btns = (p, s) => p.evaluate((s) => { const d = [...document.querySelectorAll(s)].filter((d) => d.getClientRects().length).pop() || document; return [...d.querySelectorAll('button')].filter((e) => e.getClientRects().length).map((e) => ((e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)) + (e.disabled ? '[off]' : '')).filter(Boolean).join(' | '); }, s);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
const say = (s) => { log.push(s); console.log(s); };
try {
  for (const persona of personas) for (const device of devices) {
    const phone = device === 'phone';
    const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 600)));
    const tag = `${persona}-${device}`;
    const go = async (route) => { await p.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}demo=${persona}&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' }).catch(() => {}); await p.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(() => {}); await waitReady(p); };
    // A. чужая запись по ссылке
    await go('/biz/journal');
    await p.goto(`${BASE}/biz/journal?booking=${FOREIGN}`, { waitUntil: 'networkidle' }).catch(() => {});
    await p.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(() => {});
    await p.locator('[role=dialog]').first().waitFor({ timeout: 10000 }).catch(() => {});
    await waitReady(p); await p.waitForTimeout(1200);
    const d = await dlg(p);
    say(`\n## ${tag}\nA window: lock=${/Это запись другого мастера/.test(d)} len=${d.length} buttons: ${await btns(p, '[role=dialog]')}`);
    say(`A text: ${d.slice(0, 260).replace(/\n+/g, ' / ')}`);
    await p.screenshot({ path: `${OUT}/${tag}-A-foreign.png` });
    // B. поиск
    await go('/biz/journal');
    await p.keyboard.press('Escape');
    const s = p.getByRole('button', { name: /Найти клиента|Клиенты и чат|Поиск/ }).first();
    if (await s.count()) {
      await s.click(); await p.waitForTimeout(1000);
      await p.locator('[role=dialog] input').first().fill('Мане'); await p.waitForTimeout(2200);
      const rows = await p.evaluate(() => [...document.querySelectorAll('[data-search-booking]')].map((b) => b.getAttribute('data-date') + ' ' + b.innerText.replace(/\n+/g, ' ')));
      const t = await dlg(p);
      const phones = t.match(/\+?374[\d X]{6,}|\+\d+X{5}\d\d/g) ?? [];
      say(`B search rows=${rows.length} phones=${[...new Set(phones)].slice(0, 4).join(', ')}`);
      say(`B rows: ${rows.slice(0, 8).join(' || ')}`);
      await p.screenshot({ path: `${OUT}/${tag}-B-search.png` });
      await p.keyboard.press('Escape');
    } else say('B search: button not found');
    // D. ⋯ Ещё
    await go('/biz/journal');
    const more = p.getByRole('button', { name: 'Ещё', exact: true }).last();
    if (await more.count()) {
      await more.click(); await p.waitForTimeout(1000);
      const t = await dlg(p);
      say(`D more: break=${/Технический перерыв|перерыв/i.test(t)} split=${/Делить запись по ресурсам/.test(t)} summary=${/Сводка/.test(t)}`);
      await p.screenshot({ path: `${OUT}/${tag}-D-more.png` });
      await p.keyboard.press('Escape');
    } else say('D more: button not found');
    // C. Записи
    await go('/biz/records');
    await p.waitForTimeout(1500);
    const main = await p.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
    const phones = main.match(/\+374 \d\d \d{3} \d{3}|\+\d+X{5}\d\d/g) ?? [];
    say(`C records: revenue=${/Выручка/.test(main)} excel=${/Операции с Excel/.test(main)} bot=${/бот|CRM/i.test(main)} checkboxes=${await p.locator('main input[type=checkbox], main [role=checkbox]').count()} phones=${[...new Set(phones)].slice(0, 3).join(', ')}`);
    say(`C head: ${main.slice(0, 300).replace(/\n+/g, ' / ')}`);
    await p.screenshot({ path: `${OUT}/${tag}-C-records.png` });
    if (errs.length) say(`ERR ${errs.slice(0, 4).join(' || ')}`);
    await ctx.close();
  }
} finally { await browser.close(); release(); }
