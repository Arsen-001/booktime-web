// F-01-180: historyLimit=1 день (настроен ранее в b05-rights2) — запись 3 дня назад не должна сохраняться.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const out = { steps: [] };
const log = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); console.log((ok ? '✅' : '❌'), name, detail ?? ''); };

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Найти запись НЕ сегодня (3 дня назад) через прямой evaluate по мок-базе, затем открыть по booking=
  const past = await page.evaluate(() => {
    const raw = localStorage.getItem('bp-mock-db');
    const db = JSON.parse(raw).state ?? JSON.parse(raw);
    const bookings = db.core.bookings ?? [];
    const biz = db.core.businesses?.find((b) => b.name?.includes('Nuri') || true);
    const today = new Date();
    const cands = bookings
      .filter((b) => !b.deletedAt)
      .map((b) => ({ id: b.id, date: b.date, businessId: b.businessId }))
      .filter((b) => {
        const d = new Date(b.date);
        const diffDays = Math.round((today - d) / 86400000);
        return diffDays >= 3 && diffDays <= 14;
      });
    return cands[0] ?? null;
  });
  log('найдена запись 3-14 дней назад в базе', !!past, past);

  if (past) {
    await page.goto(`${BASE}/biz/journal?demo=admin&sphere=nails&lang=ru&date=${past.date}&booking=${past.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const dialog = page.getByRole('dialog');
    await page.screenshot({ path: 'qa/shots/journal/b05-history-limit.png', fullPage: true });
    if (await dialog.count()) {
      const saveBtn = dialog.getByRole('button', { name: /Сохранить/i }).last();
      const saveDisabled = await saveBtn.isDisabled().catch(() => null);
      log('F-01-180: кнопка сохранить задизейблена для записи старше 1 дня (historyLimit=1d)', saveDisabled === true, { saveDisabled, past });
    } else {
      log('окно записи не открылось для дальней даты (?booking= не сработал через смену даты)', false, past);
    }
  }

  await ctx.close();
} catch (e) {
  out.error = String(e);
  console.error(e);
} finally {
  await browser.close();
  release();
  fs.writeFileSync('qa/measure/journal/b05-rights4-report.json', JSON.stringify(out, null, 2));
  console.log('done');
}
