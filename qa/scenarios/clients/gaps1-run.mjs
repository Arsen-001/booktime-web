// gaps-1 (проверяющий пропусков): ФИО по правам на данных сида, число отмен/неявок, «Пригласить», полное удаление по закону
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const BASE = 'http://localhost:3710';
const SHOTS = 'qa/shots/clients-gaps1';
const out = {};
async function main() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    // 1. Имена на карточках первых 12 клиентов
    out.names = [];
    for (let i = 1; i <= 0; i++) {
      const id = `cl_${String(i).padStart(3, '0')}`;
      await page.goto(`${BASE}/biz/clients/${id}?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const nm = await page.locator('[data-f="F-04-106"]').first().innerText().catch(() => null);
      const body = await page.locator('main').innerText().catch(() => '');
      const cancel = /отмен/i.test(body) ? body.split('\n').filter((l) => /отмен|не приш/i.test(l)).slice(0, 3) : [];
      out.names.push({ id, name: nm, cancelLines: cancel });
    }
    // 2. Меню «⋯» карточки: пункты
    await page.goto(`${BASE}/biz/clients/cl_005?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const moreBtn = page.locator('[data-f*="F-00-130"]').first();
    await moreBtn.click().catch(() => {});
    await page.waitForTimeout(400);
    out.menuItems = await page.getByRole('menuitem').allInnerTexts().catch(() => []);
    await page.screenshot({ path: `${SHOTS}/card-menu.png` });
    // 3. Полное удаление по закону
    const phoneBefore = await page.locator('main p.text-base.text-muted').first().innerText().catch(() => null);
    out.phoneBefore = phoneBefore;
    const purge = page.getByRole('menuitem', { name: /навсегда|полностью|по закону|Удалить все данные/i }).first();
    if (await purge.count()) {
      await purge.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/purge-confirm.png` });
      out.purgeDialog = await page.getByRole('dialog').innerText().catch(() => null);
      const confirm = page.getByRole('dialog').getByRole('button').last();
      await confirm.click();
      await page.waitForTimeout(1500);
      out.afterPurgeUrl = page.url();
      await page.screenshot({ path: `${SHOTS}/purge-after.png` });
      // ищем номер в базе
      await page.goto(`${BASE}/biz/clients?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const digits = (phoneBefore || '').replace(/\D/g, '').slice(-6);
      const search = page.locator('input[type="search"], input[placeholder*="оиск"], input[placeholder*="Имя"]').first();
      await search.fill(digits);
      await page.waitForTimeout(700);
      out.searchAfterPurge = (await page.locator('main').innerText()).slice(0, 600);
      await page.goto(`${BASE}/biz/clients/log?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      out.log = (await page.locator('main').innerText()).slice(0, 500);
    } else out.purge = 'menu item not found';
  } finally {
    await browser.close();
    release();
  }
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
