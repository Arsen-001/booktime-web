// Мок: «Список» → «…» → «Оплатить всё» → окно записи: одна строка оплаты на всю сумму; «Оплата» (finance) — оплачено
export default async ({ page, go, shot }) => {
  const r = {};
  await go('/biz/journal?demo=owner&date=2026-10-02', 5000);
  await page.getByRole('radio', { name: 'Список' }).or(page.getByRole('tab', { name: 'Список' })).or(page.getByRole('button', { name: 'Список' })).first().click();
  await page.waitForTimeout(3000);
  const row = page.locator('main').getByText('Нелли Геворгян').first().locator('xpath=ancestor::*[.//button[@aria-label]][1]');
  await row.getByRole('button').last().click(); await page.waitForTimeout(800);
  r.menu = (await page.getByRole('menu').innerText().catch(() => '')).replace(/\s+/g, ' ');
  await page.getByRole('menuitem', { name: process.env.PAYALL }).click(); await page.waitForTimeout(4000);
  await shot('list-after', false);
  r.rowAfter = (await row.innerText()).replace(/\s+/g, ' ');
  await page.locator('[aria-label="Открыть запись 10:15, Нелли Геворгян"]').click(); await page.waitForTimeout(3000);
  const dlg = page.locator('[role=dialog]').last();
  r.windowPay = (await dlg.innerText()).split('\n').filter((l) => /плач|К оплате|Наличн/.test(l));
  r.buttons = await dlg.getByRole('button').evaluateAll((els) => els.map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim()).filter((x) => /плат|плач/.test(x)));
  await dlg.getByRole('button', { name: /Оплачено|Оплатить|Смотреть оплату/ }).last().click({ timeout: 5000 }).catch((e) => { r.e = String(e).slice(0, 80); });
  await page.waitForTimeout(2000);
  r.sheet = (await dlg.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
  await shot('list-sheet', false);

  await dlg.getByRole('tab', { name: /^Оплата/ }).click().catch(() => {}); await page.waitForTimeout(2500);
  r.financeTab = (await dlg.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 260);
  return r;
};
