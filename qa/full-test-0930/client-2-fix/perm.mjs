// Перепроверка прав /biz/apps (client-2-fix, 01.10): master / admin / owner / network, телефон и десктоп
import { start, newPage, go, text } from '../client-2/h.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client-2-fix';
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
const one = (s, n = 500) => (s ?? '').slice(0, n).replace(/\n+/g, ' | ');
const { browser, done } = await start();
try {
  for (const device of ['phone', 'desktop']) {
    for (const persona of ['master', 'admin', 'owner', 'network']) {
      const { page, errors, ctx } = await newPage(browser, { device });
      const r = {};
      await go(page, '/biz/apps/reports', persona);
      r.reportsTabs = await page.getByRole('tab').allInnerTexts();
      r.reportsHasMoney = /֏/.test(await text(page));
      if (device === 'phone') await shot(page, `${persona}-reports-${device}`);
      await go(page, '/biz/apps/team', persona);
      const tt = await text(page);
      r.teamDenied = /Нет доступа|нет прав|Недостаточно/i.test(tt);
      r.teamAdd = await page.getByRole('button', { name: 'Добавить сотрудника' }).count();
      if (!r.teamDenied) {
        const ownerCard = page.locator('main li').filter({ hasText: 'Владелец' }).first();
        if (await ownerCard.count()) {
          await ownerCard.click();
          await page.waitForTimeout(800);
          const dlg = page.getByRole('dialog');
          r.ownerFire = await dlg.getByRole('button', { name: 'Уволить' }).count();
          r.ownerDelete = await dlg.getByRole('button', { name: 'Удалить' }).count();
          r.ownerNote = one(await dlg.innerText(), 300);
          await shot(page, `${persona}-team-owner-${device}`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
        const masterCard = page.locator('main li').filter({ hasText: 'Мастер' }).first();
        if (await masterCard.count()) {
          await masterCard.click();
          await page.waitForTimeout(800);
          const dlg = page.getByRole('dialog');
          r.masterFire = await dlg.getByRole('button', { name: 'Уволить' }).count();
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
      if (device === 'phone') await shot(page, `${persona}-team-${device}`);
      await go(page, '/biz/apps/payroll', persona);
      const pt = await text(page);
      r.payrollDenied = /Нет доступа|нет прав|Недостаточно/i.test(pt);
      r.payrollPicker = await page.getByText('Выберите сотрудника').count();
      await shot(page, `${persona}-payroll-${device}`);
      await go(page, '/biz/apps', persona);
      r.hubTiles = (await page.locator('main a[href^="/biz/apps/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))).join(',');
      r.errors = errors.filter((e) => !/favicon|hydrat/i.test(e)).slice(0, 3);
      console.log(device, persona, JSON.stringify(r));
      await ctx.close();
    }
  }
} catch (e) {
  console.error('FAIL', e.message);
} finally {
  await done();
}
