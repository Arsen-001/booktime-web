// Решения владельца 01.10: админ ведёт смену (finance.shift) без остальных финансов; «Предоплата» в финансах — только просмотр
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/finance';
const B = 'http://localhost:3710';
const log = (...a) => console.log(...a);
let pass = 0, fail = 0; const check = (n, ok, i = '') => { ok ? pass++ : fail++; log(ok ? 'PASS' : 'FAIL', n, i); };
const release = await acquireBrowserSlot({ timeoutMs: 120 * 60_000 });
const browser = await chromium.launch({ headless: true });
const flat = (s) => s.replace(/\s*\n\s*/g, ' | ');
try {
  for (const w of [390, 1440]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: w > 800 ? 900 : 844 } })).newPage();
    page.setDefaultTimeout(300_000);
    page.on('pageerror', (e) => log('PAGEERROR', e.message.slice(0, 200)));
    const go = async (p) => { await page.goto(B + p, { waitUntil: 'domcontentloaded', timeout: 600_000 }); await page.waitForLoadState('networkidle', { timeout: 600_000 }).catch(() => {}); await page.waitForTimeout(2500); };
    await go('/biz/finance/shift?demo=admin&lang=ru&empty=0');
    await page.getByRole('button', { name: /^(Открыть|Закрыть) смену$/ }).first().waitFor();
    await page.screenshot({ path: `${OUT}/admin-shift-${w}.png`, fullPage: true });
    const nav = w > 800 ? flat(await page.locator('nav, aside').first().innerText().catch(() => '')) : '';
    if (w > 800) check('меню администратора: «Кассовая смена» есть, «Финансы» нет', /Кассовая смена/.test(nav) && !/Финансы/.test(nav), nav.slice(0, 300));
    await page.getByRole('button', { name: 'Открыть смену' }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.locator('input').first().fill('50000');
    await dlg.getByRole('button', { name: 'Открыть смену' }).click();
    await page.waitForTimeout(2500);
    const t1 = flat(await page.locator('main').innerText());
    check(`@${w} админ открыл смену`, /Смена открыта/.test(t1), t1.slice(0, 200));
    await page.getByRole('button', { name: 'Отчёт смены' }).first().click();
    await page.waitForTimeout(800);
    const z = flat(await page.getByRole('dialog').innerText());
    check(`@${w} отчёт текущей смены`, /На открытии \| 50 000/.test(z.replace(/ | /g, ' ')), z.slice(0, 200));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Закрыть смену' }).first().click();
    await dlg.locator('input').first().fill('50000');
    await dlg.getByRole('button', { name: 'Закрыть смену' }).click();
    await page.waitForTimeout(2500);
    const z2 = flat(await page.getByRole('dialog').innerText());
    check(`@${w} админ закрыл смену, Z-отчёт`, /Z-отчёт смены/.test(z2) && /Сходится/.test(z2), z2.slice(0, 250));
    await page.screenshot({ path: `${OUT}/admin-shift-z-${w}.png` });
    await go('/biz/finance');
    const denied = flat(await page.locator('main').innerText());
    check(`@${w} админ без finance.view: операции закрыты`, /Нет прав/.test(denied), denied.slice(0, 120));
    // Владелец: «Предоплата» — только просмотр
    await go('/biz/finance/online/prepayment?demo=owner&sphere=nails&lang=ru');
    await page.getByText('Правила мастеров').first().waitFor();
    const pp = flat(await page.locator('main').innerText());
    await page.screenshot({ path: `${OUT}/prepayment-readonly-${w}.png`, fullPage: true });
    check(`@${w} «Предоплата»: правила мастеров + ссылка в онлайн-запись, без полей ввода`, /Изменить в онлайн-записи/.test(pp) && (await page.locator('main input, main [role="switch"], main [role="radio"]').count()) === 0 && /(% от суммы|֏)/.test(pp), pp.slice(0, 300));
    await page.context().close();
  }
} catch (e) { check('сценарий', false, e.message.split('\n')[0]); }
finally { await browser.close(); release(); log(`ИТОГ ${pass}/${pass + fail}`); }
