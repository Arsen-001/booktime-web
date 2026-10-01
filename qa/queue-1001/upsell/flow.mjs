// node flow.mjs <mock|api> <ru|en> <desktop|phone> — карточка услуги → запись в виджете с допродажей
import { open } from './lib.mjs';
import { clientBook, journalCheck, setRelated, widgetBook } from './steps.mjs';
const [mode = 'mock', lang = 'ru', device = 'desktop', phone = '+37400990011'] = process.argv.slice(2);
const s = await open({ mode, lang, device, role: 'owner' });
const r = {};
try {
  r.related = await setRelated(s);
  Object.assign(r, await widgetBook(s, phone));
  s.bookingDate = r.bookingDate;
  r.journal = await journalCheck(s, r.url);
  if (mode === 'mock') r.client = await clientBook(s);
} catch (e) { r.ERROR = String(e).slice(0, 700); await s.shot('error', true); }
r.errors = [...new Set(s.errors)];
await s.close();
console.log(JSON.stringify(r, null, 1));
