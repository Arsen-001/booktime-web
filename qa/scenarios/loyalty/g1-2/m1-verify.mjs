import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
import { chromium } from '@playwright/test';
const release = await acquireBrowserSlot();
const b = await chromium.launch();

// --- Check 1: quota bug still present (fresh profile) ---
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const warnings = [];
  p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
  await p.goto('http://localhost:3710/biz/loyalty?demo=owner&sphere=nails&lang=ru&theme=light');
  await p.waitForTimeout(1800);
  console.log('quota warnings on fresh load:', warnings.filter((w) => w.includes('QuotaExceeded') || w.includes('mock-db')).length);
  await ctx.close();
}

// --- Check 2: F-06-100 export button exists and is clickable (no crash) ---
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const pageErrors = [];
  p.on('pageerror', (e) => pageErrors.push(String(e)));
  await p.goto('http://localhost:3710/biz/loyalty/certificates?demo=owner&sphere=nails&lang=ru&theme=light');
  await p.waitForTimeout(1500);
  const exportBtn = p.getByRole('button', { name: /excel/i });
  const hasExport = await exportBtn.count();
  console.log('F-06-100 export button count:', hasExport);
  if (hasExport) {
    const [download] = await Promise.all([
      p.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      exportBtn.first().click(),
    ]);
    console.log('F-06-100 download fired:', !!download, download ? download.suggestedFilename() : '');
  }
  console.log('page errors:', pageErrors.length, pageErrors.slice(0, 2));
  await ctx.close();
}

// --- Check 3: F-06-129/141 filters on memberships/deposits ---
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto('http://localhost:3710/biz/loyalty/memberships?demo=owner&sphere=nails&lang=ru&theme=light');
  await p.waitForTimeout(1500);
  const before = (await p.locator('table tbody tr, [data-row]').count());
  // try a status/type filter select-like control (our Select, not native)
  const filterTrigger = p.locator('button', { hasText: /тип|Тип|Все|Статус/ }).first();
  const hasFilter = await filterTrigger.count();
  console.log('F-06-129 filter control present:', hasFilter, 'rows before:', before);
  await p.screenshot({ path: 'qa/measure/loyalty/g1-2-shots-m1/memberships-list.png', fullPage: true });
  await ctx.close();
}

// --- Check 4: F-06-139/140 deposit partial pay + over-limit red warning ---
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto('http://localhost:3710/biz/loyalty/deposits?demo=owner&sphere=nails&lang=ru&theme=light');
  await p.waitForTimeout(1500);
  const rows = await p.locator('body').innerText();
  console.log('deposits page has "долг" filter text:', rows.includes('долг') || rows.includes('Долг'));
  await p.screenshot({ path: 'qa/measure/loyalty/g1-2-shots-m1/deposits-list.png', fullPage: true });
  await ctx.close();
}

// --- Check 5: F-06-152 online-sales route ---
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const pageErrors = [];
  p.on('pageerror', (e) => pageErrors.push(String(e)));
  const resp = await p.goto('http://localhost:3710/biz/loyalty/online-sales?demo=owner&sphere=nails&lang=ru&theme=light');
  await p.waitForTimeout(1500);
  console.log('F-06-152 online-sales status:', resp ? resp.status() : 'no-response', 'errors:', pageErrors.length);
  const text = await p.locator('body').innerText();
  console.log('has "Подтвердить"/"Отклонить":', text.includes('Подтвердить'), text.includes('Отклонить'));
  await p.screenshot({ path: 'qa/measure/loyalty/g1-2-shots-m1/online-sales.png', fullPage: true });
  await ctx.close();
}

// --- Check 6: F-06-193 "запись за другого посетителя" loyalty tab shows visitor's own instruments ---
{
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light');
  await p.waitForTimeout(1500);
  const text = await p.locator('body').innerText();
  console.log('journal has "посетител" text somewhere:', text.toLowerCase().includes('посетител'));
  await ctx.close();
}

await b.close();
release();
