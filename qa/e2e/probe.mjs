// Разведка экрана для цепочек: открыть адрес от лица персоны, выполнить действия и выгрузить кнопки/поля/текст.
//   node qa/e2e/probe.mjs <persona> <route> [phone|desktop] [--click "sel"]... [--fill "sel=value"]... [--shot name]
import { chromium } from '@playwright/test';
import { makeT } from './lib.mjs';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const [persona, route, device = 'phone', ...rest] = process.argv.slice(2);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'ru-RU', timezoneId: 'Asia/Yerevan', geolocation: { latitude: 40.1792, longitude: 44.5086 }, permissions: ['geolocation'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
const t = makeT(page, 'probe', {});
await t.go(persona, route, device);
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  const v = rest[i + 1];
  if (a === '--click') { i++; try { await t.click(v); } catch (e) { console.log('CLICK FAIL', v, e.message); } }
  else if (a === '--fill') { i++; const k = v.indexOf('=>'); await t.fill(v.slice(0, k), v.slice(k + 2)).catch((e) => console.log('FILL FAIL', e.message)); }
  else if (a === '--go') { i++; const [p, r, d] = v.split(' '); await t.go(p, r, d ?? device); }
  else if (a === '--pick') { i++; const k = v.indexOf('=>'); await t.pick(v.slice(0, k), v.slice(k + 2)).catch((e) => console.log('PICK FAIL', e.message)); }
  else if (a === '--file') { i++; await page.locator('input[type=file]').first().setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }).catch((e) => console.log('FILE FAIL', e.message)); }
  else if (a === '--wait') { i++; await page.waitForTimeout(Number(v)); }
  else if (a === '--shot') { i++; console.log('SHOT', await t.shot(v)); }
  else if (a === '--eval') { i++; console.log('EVAL', JSON.stringify(await page.evaluate(v), null, 1)?.slice(0, 4000)); }
}
const info = await page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const dlg = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].filter(vis);
  const root = dlg.length ? dlg[dlg.length - 1] : document.querySelector('main') ?? document.body;
  return {
    url: location.href,
    dialog: dlg.length,
    buttons: [...root.querySelectorAll('button,[role=button],a[href]')].filter(vis).map((b) => `${b.tagName.toLowerCase()}${b.getAttribute('href') ? `[${b.getAttribute('href')}]` : ''}${b.getAttribute('role') ? `{${b.getAttribute('role')}}` : ''}${b.dataset.f ? `<${b.dataset.f}>` : ''}: ${(b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60)}`).slice(0, 80),
    inputs: [...root.querySelectorAll('input,textarea,[role=combobox],[role=radio],[role=checkbox],[role=switch],[role=tab]')].filter(vis).map((i) => `${i.tagName.toLowerCase()} role=${i.getAttribute('role')} name=${i.getAttribute('name')} ph=${i.getAttribute('placeholder')} aria=${i.getAttribute('aria-label')} type=${i.getAttribute('type')} txt=${(i.innerText || '').trim().slice(0, 40)}`).slice(0, 60),
    text: root.innerText.slice(0, 2500),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
release();
