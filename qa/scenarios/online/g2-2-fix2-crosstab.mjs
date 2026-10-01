// F-00-067 fix2: живая проверка «клиент получает пуш о решении» БЕЗ перезагрузки/переоткрытия ссылки.
// Две вкладки ОДНОГО контекста (общий localStorage, как в реальном браузере): вкладка A — клиентская
// страница /b/<slug>/booking/<id> остаётся ОТКРЫТОЙ (без page.goto после первого захода); вкладка B —
// мастер подтверждает заявку в /biz/online/requests. Дефект был: статус на вкладке A не менялся без
// ручной перезагрузки. Проверяем DOM вкладки A ПОСЛЕ действия на вкладке B, саму вкладку A не трогаем.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

  // Найти сидовую заявку awaiting_confirmation с accessHash через служебную страницу (общий localStorage контекста).
  const scout = await ctx.newPage();
  await scout.goto(`${BASE}/biz/online?demo=owner&lang=ru`);
  await scout.waitForLoadState('networkidle');
  await scout.waitForTimeout(1000);
  const dump = await scout.evaluate(() => {
    const raw = localStorage.getItem('bp-mock-db');
    if (!raw) return null;
    const db = JSON.parse(raw).state ?? JSON.parse(raw);
    const core = db.core ?? {};
    const online = db.areas?.online ?? {};
    const bookingMeta = online.bookingMeta ?? {};
    const b = (core.bookings ?? []).find((x) => x.status === 'awaiting_confirmation' && bookingMeta[x.id]?.accessHash);
    if (!b) return null;
    const biz = (core.businesses ?? []).find((x) => x.id === b.businessId);
    const client = (core.clients ?? []).find((c) => c.id === b.clientId);
    return { bookingId: b.id, hash: bookingMeta[b.id].accessHash, slug: biz?.slug, businessId: b.businessId, clientName: b.visitorName || client?.name };
  });
  await scout.close();
  if (!dump) {
    console.log('NO awaiting_confirmation booking with accessHash found in seed — cannot run this probe');
  } else {
    console.log('target:', dump);
    const clientUrl = `${BASE}/b/${dump.slug}/booking/${dump.bookingId}?h=${dump.hash}&demo=client&lang=ru`;

    // Вкладка A: клиент открывает свою запись и БОЛЬШЕ НЕ УХОДИТ с этой страницы.
    const pageA = await ctx.newPage();
    await pageA.goto(clientUrl);
    await pageA.waitForLoadState('networkidle');
    await pageA.waitForTimeout(600);
    const beforeText = await pageA.locator('body').innerText();
    console.log('A before:', beforeText.match(/Ждёт подтверждения|ждёт подтверждения|Подтверждена|подтверждена/gi)?.join(', '));
    await pageA.screenshot({ path: 'qa/shots/online-g2-2-fix2/A-before.png' });

    // Вкладка B: мастер подтверждает — ОТДЕЛЬНАЯ вкладка того же контекста (тот же localStorage-источник).
    const pageB = await ctx.newPage();
    await pageB.goto(`${BASE}/biz/online/requests?demo=individual&sphere=hair&lang=ru`);
    await pageB.waitForLoadState('networkidle');
    await pageB.waitForTimeout(600);
    console.log('target client on B list:', dump.clientName);
    const card = dump.clientName ? pageB.locator('li').filter({ hasText: dump.clientName }) : null;
    const cardCount = card ? await card.count() : 0;
    const confirmBtn = cardCount ? card.first().getByRole('button', { name: /Подтвердить/i }).first() : pageB.getByRole('button', { name: /Подтвердить/i }).first();
    const hasBtn = await confirmBtn.count();
    console.log('B confirm button found:', hasBtn);
    if (hasBtn) {
      await confirmBtn.click();
      await pageB.waitForTimeout(2500);
    }
    await pageB.screenshot({ path: 'qa/shots/online-g2-2-fix2/B-after-confirm.png' });

    // Вкладка A: НЕ навигируем и НЕ перезагружаем — просто ждём и смотрим DOM (BroadcastChannel должен долететь).
    await pageA.waitForTimeout(2500);
    const afterText = await pageA.locator('body').innerText();
    console.log('A after (no reload):', afterText.match(/Ждёт подтверждения|ждёт подтверждения|Подтверждена|подтверждена/gi)?.join(', '));
    await pageA.screenshot({ path: 'qa/shots/online-g2-2-fix2/A-after-live.png' });

    const stillWaiting = /ждёт подтверждения/i.test(afterText);
    const nowConfirmed = /подтверждена/i.test(afterText);
    console.log('RESULT: stillWaiting=', stillWaiting, 'nowConfirmed=', nowConfirmed, hasBtn ? '(button was found and clicked)' : '(NO button — inconclusive, check screenshot B)');
  }

  await ctx.close();
} finally {
  await browser.close();
  release();
}
