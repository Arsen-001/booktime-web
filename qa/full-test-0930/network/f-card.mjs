// Сценарий F: переход в карточку клиента сети из списка + вкладки карточки + телефон
import { connect, newPage, go, shot, text } from './h.mjs';
const browser = await connect();
const say = (...a) => console.log(...a);
const flat = (s, n = 400) => s.replace(/\n+/g, ' | ').slice(0, n);
for (const device of ['desktop', 'phone']) {
  const { ctx, page, errors } = await newPage(browser, { device });
  const main = page.locator('main');
  try {
    await go(page, '/biz/network/clients');
    const row = main.locator('tbody tr, [data-row], li').filter({ hasText: 'Ани Нерсесян' }).first();
    await main.getByText('Ани Нерсесян').first().click();
    await page.waitForURL(/clients\/.+/, { timeout: 20000 }).catch(() => {});
    say(device, 'after name click url:', page.url());
    if (!/clients\/./.test(page.url())) {
      await row.click({ position: { x: 300, y: 20 } }).catch(() => {});
      await page.waitForURL(/clients\/.+/, { timeout: 20000 }).catch(() => {});
      say(device, 'after row click url:', page.url());
    }
    await page.waitForTimeout(2500);
    say(device, 'CARD:', flat(await text(page), 500));
    await shot(page, `f-card-${device}`);
    for (const tab of ['Доп. поля', 'История визитов', 'Отправленные сообщения', 'Лояльность', 'Счета клиентов']) {
      const tb = main.getByRole('tab', { name: tab });
      if (await tb.count()) { await tb.click(); await page.waitForTimeout(900); const t = await text(page); say(device, `tab ${tab}:`, flat(t.slice(t.lastIndexOf('Счета клиентов') + 14), 250)); if (device === 'phone') await shot(page, `f-card-phone-${tab.replace(/\W+/g, '')}`); }
      else say(device, 'no tab', tab);
    }
  } catch (e) { say('FAIL', e.message.slice(0, 200)); }
  say(device, 'ERRORS', [...new Set(errors.filter((e) => !/DevTools|HMR|Fast Refresh/.test(e)))].slice(0, 5));
  await ctx.close();
}
await browser.close();
