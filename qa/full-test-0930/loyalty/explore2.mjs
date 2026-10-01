// Разведка: окно записи клиента с лояльностью, «Оплатить», вкладки; экраны продажи
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import { makeT, today } from '/Users/arsen/WebstormProjects/booking-platform/qa/e2e/lib.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/loyalty';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
const shot = (page, n) => page.screenshot({ path: `${OUT}/x-${n}.png` });
try {
  const ctx = await browser.newContext({ locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGEERROR', String(e).slice(0, 200)));
  const t = makeT(page, 'loy', {});
  await t.go('owner', '/biz/loyalty', 'desktop');
  const db = await t.db();
  fs.writeFileSync(OUT + '/db-seed.json', JSON.stringify(db));
  const L = db.areas.loyalty;
  const biz = 'biz_nuri';
  const d = today();
  const act = (m) => m.businessId === biz && m.balanceVisits > 0 && m.expiresAt >= d && m.status !== 'frozen';
  const withLoy = (cid) => ({
    mem: L.memberships.filter((m) => m.clientId === cid && act(m)).length,
    cert: L.certificates.filter((c) => c.clientId === cid && c.status === 'active' && c.balance > 0).length,
    card: L.cards.filter((c) => c.clientId === cid && c.balance > 0).map((c) => c.balance),
    acc: L.accounts.filter((a) => a.clientId === cid && a.balance > 0).length,
  });
  const cands = db.core.bookings.filter((b) => b.businessId === biz && !b.deletedAt && b.clientId && b.total > 0 && /^(scheduled|client_confirmed|arrived)$/.test(b.status) && b.start >= d);
  const scored = cands.map((b) => ({ b, l: withLoy(b.clientId) })).filter((x) => x.l.mem || x.l.cert || x.l.card.length || x.l.acc);
  log('cands', cands.length, 'with loyalty', scored.length);
  for (const x of scored.slice(0, 15)) log(x.b.id, x.b.start, x.b.status, x.b.total, x.b.clientId, JSON.stringify(x.l), x.b.services.map((s) => s.serviceId).join(','));
  const pick = scored.find((x) => x.b.start.startsWith(d)) ?? scored[0];
  if (!pick) throw new Error('нет кандидатов');
  await t.go('owner', `/biz/journal?date=${pick.b.start.slice(0, 10)}&booking=${pick.b.id}`, 'desktop');
  await t.settle(1500);
  await shot(page, 'bw-open');
  const dlg = page.locator('[role="dialog"]').first();
  log('DIALOG', (await dlg.innerText().catch(() => '')).replace(/\n+/g, ' · ').slice(0, 1500));
  log('TABS', await page.locator('[role="tab"]').allInnerTexts());
  const tabs = page.locator('[role="dialog"] [role="tab"]');
  for (let i = 0; i < (await tabs.count()); i++) {
    const name = (await tabs.nth(i).innerText()).trim();
    if (/Лояльн|Оплат/.test(name)) {
      await tabs.nth(i).click(); await t.settle(1200);
      await shot(page, 'bw-tab-' + i);
      log('TAB', name, '::', (await dlg.innerText()).replace(/\n+/g, ' · ').slice(0, 1500));
    }
  }
  const pay = dlg.getByRole('button', { name: /^Оплатить/ }).first();
  log('pay button', await pay.count());
  if (await pay.count()) {
    await pay.click(); await t.settle(1200);
    await shot(page, 'pay-sheet');
    const top = page.locator('[role="dialog"]').last();
    log('PAYSHEET', (await top.innerText()).replace(/\n+/g, ' · ').slice(0, 1500));
  }
  for (const r of ['/biz/loyalty/memberships', '/biz/loyalty/certificates', '/biz/loyalty/deposits', '/biz/loyalty/cards']) {
    await t.go('owner', r, 'desktop');
    await shot(page, 'r' + r.replaceAll('/', '_'));
    log('ROUTE', r, (await t.mainText()).replace(/\n+/g, ' · ').slice(0, 600));
    log('BUTTONS', (await page.locator('main button').allInnerTexts()).filter(Boolean).slice(0, 25).join(' | '));
  }
} finally { await browser.close(); release(); }
