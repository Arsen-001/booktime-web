// UI-проход раздела payroll: снимки телефон/десктоп ru (+en выборочно), пусто, ошибка, мастер/админ; действие — поле «за запись».
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/payroll/ui';
fs.mkdirSync(OUT, { recursive: true });
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
try {
  const shots = [
    ['/biz/payroll', 'owner', 'ru'], ['/biz/payroll/daily', 'owner', 'ru'], ['/biz/payroll/period', 'owner', 'ru'],
    ['/biz/payroll/settings', 'owner', 'ru'], ['/biz/payroll/bonuses', 'owner', 'ru'], ['/biz/payroll/settlements', 'owner', 'ru'],
    ['/biz/payroll/analytics', 'owner', 'ru'], ['/biz/payroll/rules', 'owner', 'ru'], ['/biz/payroll/charts', 'owner', 'ru'],
    ['/biz/payroll/criteria', 'owner', 'ru'], ['/biz/payroll/setup', 'owner', 'ru'], ['/biz/payroll/statement/new', 'owner', 'ru'],
    ['/biz/payroll/me', 'master', 'ru'], ['/biz/payroll/daily', 'master', 'ru'], ['/biz/payroll/period', 'admin', 'ru'],
    ['/biz/payroll/period', 'owner', 'en'], ['/biz/payroll', 'owner', 'en'],
    ['/biz/payroll/period', 'owner-empty', 'ru'], ['/biz/payroll', 'owner-empty', 'ru'], ['/biz/payroll/daily', 'owner-empty', 'ru'],
  ];
  for (const [device, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(90000);
    let errs = [];
    page.on('pageerror', e => errs.push('pageerror ' + String(e).slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    for (const [route, persona, lang] of shots) {
      if (device === 'phone' && lang === 'en') continue;
      errs = [];
      const [demo, empty] = persona === 'owner-empty' ? ['owner', '1'] : [persona, '0'];
      await page.goto(`${B}${route}?demo=${demo}&empty=${empty}&sphere=nails&lang=${lang}`, { waitUntil: 'networkidle' }).catch(e => errs.push('goto ' + e));
      await page.waitForTimeout(1800);
      const name = `${route.replace(/\//g, '_')}__${persona}-${lang}-${device}`;
      await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 90000, animations: 'disabled' }).catch(e => errs.push('shot ' + String(e).slice(0, 60)));
      const txt = await page.innerText('body').catch(() => '');
      const raw = txt.match(/\bpayroll\.[a-zA-Z.]+/g);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1).catch(e => 'ERR ' + String(e).slice(0, 50));
      log.push(`${name} → ${page.url().replace(B, '')}: errs=${errs.length}${errs.length ? ' ' + errs.slice(0, 2).join(' | ') : ''} raw=${raw ? raw.slice(0, 3) : 0} overflow=${overflow}`);
      if (device === 'desktop' && lang === 'ru') fs.writeFileSync(`${OUT}/${name}.txt`, txt);
      fs.writeFileSync(`${OUT}/log.partial.txt`, log.join('\n'));
    }
    await ctx.close();
  }
  // Ошибка api
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(90000);
    for (const r of ['/biz/payroll/period', '/biz/payroll/daily']) {
      await page.goto(`${B}${r}?demo=owner&sphere=nails&lang=ru&api=error`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/${r.replace(/\//g, '_')}__error.png`, timeout: 90000 }).catch(() => {});
      log.push(`${r} api=error: ${(await page.innerText('main').catch(() => '')).slice(0, 200).replace(/\n/g, ' / ')}`);
    }
    // Действие: схема администратора — поле «Вознаграждение за созданную запись» → 500 → сохранить → перезагрузить
    await page.goto(`${B}/biz/payroll/staff/st_nuri_admin?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const field = page.getByLabel('Вознаграждение за созданную запись');
    log.push('поле «за запись» найдено: ' + await field.count());
    if (await field.count()) {
      await field.first().fill('500');
      await page.screenshot({ path: `${OUT}/scheme-admin-records-filled.png`, fullPage: true, timeout: 90000 }).catch(() => {});
      await page.getByRole('button', { name: 'Сохранить' }).first().click();
      await page.waitForTimeout(1500);
      log.push('тост: ' + (await page.innerText('body')).match(/Схема сохранена|Не удалось[^\n]*/)?.[0]);
      await page.waitForTimeout(1500);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      log.push('после перезагрузки значение: ' + await page.getByLabel('Вознаграждение за созданную запись').first().inputValue().catch(e => 'ERR ' + e));
      await page.goto(`${B}/biz/payroll/period?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      fs.writeFileSync(`${OUT}/period-after-records.txt`, await page.innerText('main'));
      await page.screenshot({ path: `${OUT}/period-after-records.png`, fullPage: true, timeout: 90000 }).catch(() => {});
    }
    await ctx.close();
  }
} finally { await browser.close(); release(); fs.writeFileSync(`${OUT}/log.txt`, log.join('\n')); console.log(log.join('\n')); }
