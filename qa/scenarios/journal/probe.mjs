import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-g3-1-m1/probe';
fs.mkdirSync(OUT, { recursive: true });

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
function L(...a) { console.log(...a); log.push(a.join(' ')); }

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', (e) => consoleErrs.push('pageerror: ' + e.message));

  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // F-01-024 / F-01-037: click empty cell to open new booking window
  const cells = page.locator('[data-f~="F-01-024"]');
  const cellCount = await cells.count();
  L('F-01-024 cells found:', cellCount);
  if (cellCount > 0) {
    // find a cell not overlapped by a booking block: click at 22:00 row (far down, likely empty)
    let clicked = false;
    for (let i = cellCount - 1; i >= 0 && !clicked; i--) {
      const c = cells.nth(i);
      const box = await c.boundingBox();
      if (!box || box.y < 0) continue;
      const topEl = await page.evaluate(({x,y}) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.outerHTML.slice(0, 80) : null;
      }, { x: box.x + box.width/2, y: box.y + box.height/2 });
      L('cell', i, 'topEl:', topEl);
      if (topEl && !/data-f="F-01-026/.test(topEl)) {
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        clicked = true;
      }
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/01-new-booking-window.png` });
    const windowVisible = await page.locator('[data-f~="F-01-037"]').count();
    L('F-01-037 booking window panel present after click:', windowVisible);
    // check three zones / tiles hidden for new record
    const html = await page.content();
    fs.writeFileSync(`${OUT}/new-booking.html`, html);
    // Escape / close
    const closeBtn = page.locator('button:has-text("Скрыть"), [aria-label="Закрыть"], [aria-label="Скрыть"]').first();
    if (await closeBtn.count()) {
      L('close/hide button found');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Now click an existing booking block if present -> F-01-030, F-01-026, F-01-029
  const block = page.locator('[data-f~="F-01-026"]').first();
  const blockCount = await page.locator('[data-f~="F-01-026"]').count();
  L('F-01-026 blocks found:', blockCount);
  if (blockCount > 0) {
    const box = await block.boundingBox();
    L('block box', JSON.stringify(box));
    await block.click({ force: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/02-open-existing-record.png` });
    const html2 = await page.content();
    const hasEditDeleteMenu = /Изменить<\/[^>]*>[\s\S]{0,200}Удалить/.test(html2) || html2.includes('✎') || html2.includes('🗑');
    L('short edit/delete menu markup found (heuristic):', hasEditDeleteMenu);
    // right click test
    await page.mouse.move(box.x + 10, box.y + 5);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // right-click on a block (F-01-030: no custom context menu, and shouldn't trigger drag/confirm dialog)
  let dialogFired = false;
  page.on('dialog', async (d) => { dialogFired = true; await d.dismiss(); });
  if (blockCount > 0) {
    const box2 = await block.boundingBox();
    if (box2) {
      await page.mouse.click(box2.x + box2.width/2, box2.y + box2.height/2, { button: 'right' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/03-rightclick.png` });
    }
  }
  L('native dialog fired on right-click:', dialogFired);

  // reopen the existing record (right-click may have closed nothing, ensure open)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await block.click({ force: true });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/03b-reopened.png` });
  const tabs = ['Клиент', 'Оплата', 'Лояльность', 'Расходники', 'Уведомления'];
  for (const tabName of tabs) {
    const tab = page.locator(`button:has-text("${tabName}")`).first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/tab-${tabName}.png` });
      L('tab opened:', tabName);
    } else {
      L('tab NOT FOUND:', tabName);
    }
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // hover status icon F-01-029
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // F-01-156 waitlist panel
  const waitlistToggle = page.locator('[data-f~="F-01-156"]').first();
  const wlCount = await page.locator('[data-f~="F-01-156"]').count();
  L('F-01-156 elements:', wlCount);
  if (wlCount > 0) {
    await page.screenshot({ path: `${OUT}/04-waitlist.png` });
  }

  L('console errors so far:', JSON.stringify(consoleErrs));

  // F-01-006 location switcher: search header for locations
  const locSwitcher = (await page.locator('text=/локац/i').count()) + (await page.locator('[data-f~="F-01-006"]').count());
  L('location switcher elements (heuristic):', locSwitcher);

  // F-01-181 records report: filters
  await page.goto(`${BASE}/biz/records?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/05-records-report.png` });
  const cancelledFilterCount = await page.locator('text=/Отмен/i').count();
  L('records report "Отменённые" filter text occurrences:', cancelledFilterCount);

  fs.writeFileSync(`${OUT}/probe-log.txt`, log.join('\n'));
  await ctx.close();
} catch (e) {
  L('ERROR', e.message);
  fs.writeFileSync(`${OUT}/probe-log.txt`, log.join('\n'));
} finally {
  await browser.close();
  release();
}
