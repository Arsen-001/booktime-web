// node pay.mjs <mock|api> <bookingId> <date> — журнал → Оплатить → Наличные; затем «Допродано» в карточке услуги
import { open, settle, BASE } from './lib.mjs';
const [mode = 'api', id, date, lang = 'ru'] = process.argv.slice(2);
const s = await open({ mode, lang, device: 'desktop', role: 'owner' });
const r = {};
try {
  const q = mode === 'mock' ? `&demo=owner&lang=${lang}&data=mock` : `&lang=${lang}&data=api`;
  await s.page.goto(`${BASE}/biz/journal?booking=${id}&date=${date}${q}`, { waitUntil: 'domcontentloaded' });
  await settle(s.page, 3500);
  const dialog = s.page.getByRole('dialog').last();
  await dialog.getByRole('button', { name: lang === 'ru' ? 'Оплатить' : 'Pay', exact: true }).first().click();
  await settle(s.page, 1500);
  await s.page.getByRole('dialog').last().getByText(lang === 'ru' ? 'Наличные' : 'Cash').first().click();
  await settle(s.page, 2500);
  await s.shot('11-journal-paid');
  r.after = (await s.page.getByRole('dialog').last().innerText()).replace(/\s+/g, ' ').slice(0, 600);
  await s.page.goto(`${BASE}/biz/services/sv_nuri_gel?lang=${lang}&data=${mode}`, { waitUntil: 'domcontentloaded' });
  await settle(s.page, 3000);
  const sec = s.page.locator('section', { hasText: lang === 'ru' ? 'Сопутствующие услуги и товары' : 'Add-on services and products' }).first();
  await sec.scrollIntoViewIfNeeded();
  await s.shot('12-service-stats');
  r.stats = (await sec.innerText()).replace(/\s+/g, ' ').slice(-120);
} catch (e) { r.ERROR = String(e).slice(0, 500); await s.shot('pay-error'); }
r.errors = [...new Set(s.errors)];
await s.close();
console.log(JSON.stringify(r, null, 1));
