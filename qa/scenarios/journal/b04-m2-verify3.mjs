import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log('[m2c]', ...a);
async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
}

try {
  // Phone: open "more" menu
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(1000);
  const moreBtn = phone.locator('button').filter({ hasText: '⋯' }).first();
  const candidateMore = (await moreBtn.count()) ? moreBtn : phone.locator('header button, [class*="header"] button').last();
  await candidateMore.click({ force: true }).catch(async () => {
    // fallback: click by position near top-right cluster (icon 3 of the 3 circular icons)
    await phone.mouse.click(704, 403);
  });
  await phone.waitForTimeout(500);
  await shot(phone, '60-phone-more-menu-open');
  const menuTexts = await phone.locator('[role="menu"], [role="dialog"]').first().innerText().catch(() => '(not found)');
  log('phone more-menu content:', JSON.stringify(menuTexts).slice(0, 500));
  await phone.close();

  // Desktop: F-01-005 favorites star toggle
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desk.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(1000);
  const star = desk.locator('[data-f~="F-01-005"] button, button:has-text("☆")').first();
  const starIcon = desk.locator('h1:has-text("Журнал") ~ * button, header button svg').first();
  // Use the star icon next to the "Журнал" h1 (seen in screenshots directly under title)
  const starByPos = desk.getByRole('button', { name: /Избранное|звезд/i }).first();
  let starBtn = star;
  if (!(await starBtn.count())) starBtn = starByPos;
  log('star button count:', await starBtn.count());
  if (await starBtn.count()) {
    await starBtn.click().catch(() => {});
    await desk.waitForTimeout(400);
    await shot(desk, '61-favorite-toggled-on');
    // check "Избранное" section in left rail now lists Журнал
    const favSection = desk.locator('text=Избранное').locator('..');
    await shot(desk, '62-favorites-section');
    await starBtn.click().catch(() => {}); // toggle back off
    await desk.waitForTimeout(300);
    await shot(desk, '63-favorite-toggled-off');
  }

  // F-01-130: add a real second service via chip and check duration+total
  const block = desk.locator('[data-testid="booking-block"]').first();
  await block.click();
  await desk.waitForTimeout(500);
  let dialog = desk.getByRole('dialog');
  const beforeHeader = await dialog.locator('text=/\\d{2}:\\d{2}–\\d{2}:\\d{2}/').first().innerText().catch(() => '?');
  log('duration before:', beforeHeader);
  const servicesTab = dialog.getByRole('tab', { name: /Услуги/ }).first();
  await servicesTab.click().catch(() => {});
  await desk.waitForTimeout(300);
  const chip = dialog.getByText('Маникюр классический', { exact: false }).first();
  if (await chip.count()) {
    await chip.click().catch(() => {});
    await desk.waitForTimeout(500);
    await shot(desk, '64-second-service-added');
    const recordTab = dialog.getByRole('tab', { name: /Запись/ }).first();
    await recordTab.click().catch(() => {});
    await desk.waitForTimeout(300);
    const afterHeader = await dialog.locator('text=/\\d{2}:\\d{2}–\\d{2}:\\d{2}/').first().innerText().catch(() => '?');
    log('duration after adding service:', afterHeader);
    await shot(desk, '65-record-tab-after-add');
  } else {
    log('service chip not found');
  }
  await desk.keyboard.press('Escape').catch(() => {});
  await desk.waitForTimeout(300);

  // F-01-163: right panel create-record affordance re-check with fresh dialog closed
  const peopleBtn = desk.getByRole('button', { name: /Клиенты и чат|панель/i }).first();
  const iconBtn2 = desk.locator('header button').filter({ has: desk.locator('svg') });
  const rightPanelBtn = desk.locator('button:near(:text("Новая запись"))').first();
  await shot(desk, '66-before-right-panel');
  await desk.close();
} catch (e) {
  console.error('SCRIPT ERROR', e);
} finally {
  await browser.close();
  release();
}
